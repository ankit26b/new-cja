import pandas as pd
import psycopg2
from psycopg2 import OperationalError
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
from sklearn.metrics import classification_report
from sklearn.metrics import balanced_accuracy_score
from sklearn.metrics import confusion_matrix
from sklearn.utils.class_weight import compute_sample_weight
import joblib

import os
from pathlib import Path


def load_env_file(env_path: Path):
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")

        if key and key not in os.environ:
            os.environ[key] = value


# Load project-level .env automatically when running from ml-models/
PROJECT_ROOT = Path(__file__).resolve().parents[1]
load_env_file(PROJECT_ROOT / ".env")

db_host = os.environ.get("DB_HOST", "localhost")
db_name = os.environ.get("DB_NAME", "cja")
db_user = os.environ.get("DB_USER", "postgres")
db_password = os.environ.get("DB_PASSWORD", "postgres")
db_port = int(os.environ.get("DB_PORT", "5432"))

# Connect to PostgreSQL
try:
    conn = psycopg2.connect(
        host=db_host,
        database=db_name,
        user=db_user,
        password=db_password,
        port=db_port,
    )
except OperationalError:
    print("Database connection failed.")
    print(f"Host={db_host} Port={db_port} DB={db_name} User={db_user}")
    print("Tip: update DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD in project .env")
    raise

# Get session data
query = """
SELECT 
    s.session_id,
    s.duration,
    s.total_clicks,
    s.max_scroll_depth,
    s.total_pages,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM events e 
            WHERE e.session_id = s.session_id 
            AND (
                e.page_url IN (
                    '/payment', '/payment/',
                    '/order-confirmed', '/order-confirmed/'
                )
                OR e.page_url LIKE '%/payment%'
                OR e.page_url LIKE '%/order-confirmed%'
            )
        )
        THEN 0
        ELSE 1
    END AS drop_off
FROM sessions s
WHERE s.duration IS NOT NULL;
"""

df = pd.read_sql(query, conn)

conn.close()

# Features & Label
X = df[['duration', 'total_clicks', 'max_scroll_depth', 'total_pages']]
y = df['drop_off']

class_counts = y.value_counts().to_dict()
print("Class counts:", class_counts)

if y.nunique() < 2:
    raise ValueError("Training data has only one class. Need both drop-off and converted sessions.")

minority_class_count = int(y.value_counts().min())
if minority_class_count < 2:
    raise ValueError("Not enough minority-class samples for train/test split. Collect more converted sessions.")

# Train-test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# Train model
sample_weight_train = compute_sample_weight(class_weight='balanced', y=y_train)

model = XGBClassifier(
    n_estimators=200,
    max_depth=4,
    learning_rate=0.05,
    subsample=0.9,
    colsample_bytree=0.9,
    random_state=42,
    eval_metric='logloss'
)
model.fit(X_train, y_train, sample_weight=sample_weight_train)

# Evaluate
predictions = model.predict(X_test)
accuracy = accuracy_score(y_test, predictions)
balanced_acc = balanced_accuracy_score(y_test, predictions)

majority_baseline = max(y_test.mean(), 1 - y_test.mean())

print("Model Accuracy:", accuracy)
print("Balanced Accuracy:", round(balanced_acc, 4))
print("Majority-class baseline accuracy:", round(float(majority_baseline), 4))

print("Total sessions:", len(df))
print(df['drop_off'].value_counts())

print(classification_report(y_test, predictions, zero_division=0))
print("Confusion Matrix:\n", confusion_matrix(y_test, predictions))

# Save model
joblib.dump(model, "xgboost_model.pkl")

print("Model saved successfully.")