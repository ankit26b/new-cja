from fastapi import FastAPI
import joblib
import numpy as np
from transformers import pipeline

app = FastAPI()

#Load XGBoost model
model = joblib.load("xgboost_model.pkl")

#Load BERT sentiment analysis model
sentiment_model = pipeline("sentiment-analysis")

#------Drop-off prediction endpoint------
@app.post("/predict")
def predict(data: dict):

    features = np.array([[
        data["duration"],
        data["total_clicks"],
        data["max_scroll_depth"],
        data["total_pages"]
    ]])

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