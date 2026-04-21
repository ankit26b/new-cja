import joblib
import numpy as np
from xgboost import XGBClassifier

# Create a minimal dummy model with 4 features (duration, total_clicks, max_scroll_depth, total_pages)
X_dummy = np.array([
    [120, 5, 50, 3],
    [60, 2, 25, 2],
    [180, 10, 75, 4],
    [30, 1, 10, 1]
])

y_dummy = np.array([0, 1, 0, 1])  # 0 = no drop-off, 1 = drop-off

model = XGBClassifier(n_estimators=10, random_state=42)
model.fit(X_dummy, y_dummy)

joblib.dump(model, "xgboost_model.pkl")
print("Dummy model created and saved as xgboost_model.pkl")
