# TSD

## 1. Architecture

Frontend
Next.js

Backend
Next.js API Routes

Database
Supabase

Agent Logic
LangGraph

Restaurant Data
Google Places API or Yelp API

## 2. Core Services

The system will contain these core services:

slotResolver
Determines which budget slot applies based on time.

restaurantProvider
Fetches nearby restaurants from external APIs.

recommendationScorer
Scores restaurants based on preferences and budget.

wildcardEngine
Finds an unexpected but interesting restaurant.

personalizationEngine
Learns from user behavior.

chatOrchestrator
Handles chat requests.

## 3. Database Schema

Tables

profiles

budget_slots

user_preferences

restaurant_cache

recommendation_events

user_actions

## 4. Recommendation Flow

1. User opens app
2. System determines current time slot
3. System fetches user budget
4. System fetches nearby restaurants
5. System filters restaurants
6. System scores restaurants
7. System returns top 3–5
8. Optional wildcard recommendation

## 5. AI Responsibilities

AI is used for:

- interpreting user requests

• generating explanations

• suggesting wildcard picks

• personalization hints

AI is NOT used for:

- database queries

• ranking logic

• location filtering