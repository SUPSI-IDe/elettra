# API Reference

> Last updated: 2026-06-01

This document catalogs all backend API endpoints consumed by the ELETTRA frontend.

**Important**: The backend is a separate service (not in this repository). This reference is derived from the frontend's API client code and the root-level `API_REFERENCE.md`. The backend's Swagger/OpenAPI documentation at `/docs` remains the authoritative source of truth for request/response schemas.

**Base URL**: `http://isaac-elettra.dacd.supsi.ch:8002`
**Swagger UI**: <http://isaac-elettra.dacd.supsi.ch:8002/docs>

---

## Authentication (`/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Authenticate and get JWT token |
| POST | `/auth/logout` | Logout |
| GET | `/auth/me` | Get current user info |
| PUT | `/auth/me` | Update profile |
| DELETE | `/auth/me` | Delete account |
| PUT | `/auth/me/password` | Update password |
| GET | `/auth/check-email/{email}` | Check email availability |

---

## Agency Management (`/api/v1/agency`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/agency/agencies/` | List agencies |
| POST | `/api/v1/agency/agencies/` | Create agency |
| GET | `/api/v1/agency/agencies/{agency_id}` | Get agency details |
| GET | `/api/v1/agency/users/` | List users in agency |
| POST | `/api/v1/agency/users/` | Create user in agency |
| GET | `/api/v1/agency/users/{user_id}` | Get user details |
| PUT | `/api/v1/agency/users/{user_id}` | Update user |

---

## Fleet Management (`/api/v1/user`)

### Bus Models

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/user/bus-models/` | List models |
| POST | `/api/v1/user/bus-models/` | Create model |
| GET | `/api/v1/user/bus-models/{model_id}` | Get model |
| PUT | `/api/v1/user/bus-models/{model_id}` | Update model |
| DELETE | `/api/v1/user/bus-models/{model_id}` | Delete model |

### Buses

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/user/buses/` | List buses |
| POST | `/api/v1/user/buses/` | Create bus |
| GET | `/api/v1/user/buses/{bus_id}` | Get bus |
| PUT | `/api/v1/user/buses/{bus_id}` | Update bus |
| DELETE | `/api/v1/user/buses/{bus_id}` | Delete bus |

### Depots

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/user/depots/` | List depots |
| POST | `/api/v1/user/depots/` | Create depot |
| GET | `/api/v1/user/depots/{depot_id}` | Get depot |
| PUT | `/api/v1/user/depots/{depot_id}` | Update depot |
| DELETE | `/api/v1/user/depots/{depot_id}` | Delete depot |

### Shifts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/user/shifts/` | List shifts |
| POST | `/api/v1/user/shifts/` | Create shift |
| GET | `/api/v1/user/shifts/{shift_id}` | Get shift |
| PUT | `/api/v1/user/shifts/{shift_id}` | Update shift |
| DELETE | `/api/v1/user/shifts/{shift_id}` | Delete shift |

---

## GTFS Data (`/api/v1/gtfs`)

### Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/gtfs/gtfs-routes/` | List routes |
| POST | `/api/v1/gtfs/gtfs-routes/` | Create route |
| GET | `/api/v1/gtfs/gtfs-routes/{route_id}` | Get route |
| GET | `/api/v1/gtfs/gtfs-routes/by-agency/{agency_id}` | Get routes by agency |
| GET | `/api/v1/gtfs/gtfs-routes/by-stop/{stop_id}` | Get routes by stop |

### Trips

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/gtfs/gtfs-trips/by-route/{route_id}` | Get trips by route |
| GET | `/api/v1/gtfs/gtfs-trips/by-stop/{stop_id}` | Get trips by stop |
| POST | `/api/v1/gtfs/gtfs-trips/` | Create trip |
| PUT | `/api/v1/gtfs/gtfs-trips/{trip_pk}` | Update trip |
| DELETE | `/api/v1/gtfs/gtfs-trips/{trip_pk}` | Delete trip |
| POST | `/api/v1/gtfs/aux-trip` | Create auxiliary trip (deadhead) |

### Stops

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/gtfs/gtfs-stops/` | List stops |
| POST | `/api/v1/gtfs/gtfs-stops/` | Create stop |
| GET | `/api/v1/gtfs/gtfs-stops/{stop_pk}` | Get stop |
| PUT | `/api/v1/gtfs/gtfs-stops/{stop_pk}` | Update stop |
| DELETE | `/api/v1/gtfs/gtfs-stops/{stop_pk}` | Delete stop |
| GET | `/api/v1/gtfs/gtfs-stops/by-trip/{trip_id}` | Get stops by trip |

### Calendar

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/gtfs/gtfs-calendar/by-trip/{trip_id}` | Get calendar by trip |

### Variants & Elevation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/gtfs/variants/by-route/{route_id}` | Get variants by route |
| GET | `/api/v1/gtfs/variants/{route_id}/{variant_num}` | Get specific variant |
| GET | `/api/v1/gtfs/elevation-profile/by-trip/{trip_id}` | Get elevation profile |
| GET | `/api/v1/gtfs/osrm/driving-distance` | Get driving distance |

---

## Simulation (`/api/v1/simulation`)

### Prediction Runs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/simulation/prediction-runs/` | Create prediction run(s) |
| GET | `/api/v1/simulation/prediction-runs/` | List prediction runs |
| GET | `/api/v1/simulation/prediction-runs/{run_id}` | Get prediction run |
| DELETE | `/api/v1/simulation/prediction-runs/{run_id}` | Delete prediction run |
| GET | `/api/v1/simulation/prediction-runs/{run_id}/predictions` | Get predictions |

### Optimization Runs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/simulation/optimization-runs/` | Create optimization run |
| GET | `/api/v1/simulation/optimization-runs/` | List optimization runs (paginated) |
| GET | `/api/v1/simulation/optimization-runs/{run_id}` | Get optimization run details |
| DELETE | `/api/v1/simulation/optimization-runs/{run_id}` | Delete optimization run |

### Trip Statistics & Weather

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/simulation/trip-statistics/` | Compute trip statistics |
| GET | `/api/v1/simulation/pvgis-tmy/` | Get PVGIS weather data |
| GET | `/api/v1/simulation/weather-temperature-clusters/` | Get temperature clusters |
| POST | `/api/v1/simulation/weather-temperature-clusters/` | Create temperature clusters |

---

## Yearly Analysis (`/api/v1/yearly-analysis`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/yearly-analysis/` | Create yearly analysis |
| GET | `/api/v1/yearly-analysis/` | List yearly analyses (paginated) |
| GET | `/api/v1/yearly-analysis/{id}` | Get yearly analysis |
| PATCH | `/api/v1/yearly-analysis/{id}` | Update yearly analysis |
| DELETE | `/api/v1/yearly-analysis/{id}` | Delete yearly analysis |
| GET | `/api/v1/yearly-analysis/{id}/costs` | Get yearly costs |
| GET | `/api/v1/yearly-analysis/{id}/emissions` | Get yearly emissions |

---

## Economic (`/api/v1/economic`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/economic/defaults` | Get economic parameter defaults |
| GET | `/api/v1/economic/comparison` | Compute economic comparison |

---

## Environmental (`/api/v1/environmental`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/environmental/vehicles` | List LCA vehicles |
| GET | `/api/v1/environmental/vehicles/{id}/impact` | Get vehicle environmental impact |
| GET | `/api/v1/environmental/shifts/{shift_id}/yearly-impact` | Get shift yearly environmental impact |
| GET | `/api/v1/environmental/electricity-mixes` | List electricity mixes |

---

## System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Root status |
| GET | `/health` | Health check |

---

## Notes

- All endpoints except `/auth/login`, `/auth/register`, and system endpoints require JWT authentication via `Authorization: Bearer <token>` header.
- Paginated endpoints accept `skip` and `limit` query parameters.
- The frontend's API client code in `src/api/` contains the most up-to-date integration details for each endpoint.
