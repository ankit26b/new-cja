from fastapi import FastAPI
import joblib
import numpy as np
from transformers import pipeline

app = FastAPI()


@app.get("/")
def root():
    return {
        "service": "CJA ML API",
        "status": "running",
        "endpoints": ["POST /predict", "POST /sentiment", "GET /health", "GET /docs"]
    }


@app.get("/health")
def health():
    return {"status": "ok"}

#Load XGBoost model
model = joblib.load("xgboost_model.pkl")

#Load BERT sentiment analysis model
sentiment_model = pipeline("sentiment-analysis")

#------Drop-off prediction endpoint------
# NOTE: engagement_score is included as a 5th feature. The XGBoost model
# may need retraining on data that includes engagement_score before it
# can take advantage of this additional signal.
@app.post("/predict")
def predict(data: dict):

    # engagement_score = (avg_scroll_depth * 0.40)
    #                  + (normalized_duration * 0.35)
    #                  + (normalized_clicks * 0.25)
    engagement_score = data.get("engagement_score", 0)

    features_4 = np.array([[
        data["duration"],
        data["total_clicks"],
        data["max_scroll_depth"],
        data["total_pages"]
    ]])

    features_5 = np.array([[
        data["duration"],
        data["total_clicks"],
        data["max_scroll_depth"],
        data["total_pages"],
        engagement_score
    ]])

    model_feature_count = getattr(model, "n_features_in_", None)
    if model_feature_count == 4:
        features = features_4
    else:
        features = features_5

    prediction = model.predict(features)[0]
    probability = model.predict_proba(features)[0][1]

    return {
        "drop_off_prediction": int(prediction),
        "drop_off_probability": float(probability)
    }

#------Sentiment analysis endpoint------
@app.post("/sentiment")
def analyze_sentiment(data: dict):
    text = data["text"]
    result = sentiment_model(text)[0]
    return {
        "label": result["label"],
        "score": float(result["score"])
    }