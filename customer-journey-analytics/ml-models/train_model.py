import pandas as pd
import psycopg2
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
from sklearn.metrics import classification_report
import joblib

# Connect to PostgreSQL
conn = psycopg2.connect(
    host="localhost",
    database="cja",
    user="postgres",
    password="postgres123"
)

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
            AND e.page_url = '/payment'
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

# Train-test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# Train model
model = XGBClassifier()
model.fit(X_train, y_train)

# Evaluate
predictions = model.predict(X_test)
accuracy = accuracy_score(y_test, predictions)

print("Model Accuracy:", accuracy)

print("Total sessions:", len(df))
print(df['drop_off'].value_counts())


print(classification_report(y_test, predictions))

# Save model
joblib.dump(model, "xgboost_model.pkl")

print("Model saved successfully.")