# API Reference

**Base URL**: `http://isaac-elettra.dacd.supsi.ch:8002`
**Documentation**: [Swagger UI](http://isaac-elettra.dacd.supsi.ch:8002/docs)

## Authentication (`/auth`)
*   `POST /auth/register`: Register a new user.
*   `POST /auth/login`: Authenticate and get a JWT token.
*   `POST /auth/logout`: Logout.
*   `GET /auth/me`: Get current user info.
*   `PUT /auth/me`: Update profile.
*   `DELETE /auth/me`: Delete account.
*   `PUT /auth/me/password`: Update password.
*   `GET /auth/check-email/{email}`: Check email availability.

## Agency Management (`/api/v1/agency`)
*   `GET /api/v1/agency/agencies/`: List agencies.
*   `POST /api/v1/agency/agencies/`: Create agency.
*   `GET /api/v1/agency/agencies/{agency_id}`: Get agency details.
*   `GET /api/v1/agency/users/`: List users in agency.
*   `POST /api/v1/agency/users/`: Create user in agency.
*   `GET /api/v1/agency/users/{user_id}`: Get user details.
*   `PUT /api/v1/agency/users/{user_id}`: Update user.

## Fleet Management (`/api/v1/user`)
### Bus Models
*   `GET /api/v1/user/bus-models/`: List models.
*   `POST /api/v1/user/bus-models/`: Create model.
*   `GET /api/v1/user/bus-models/{model_id}`: Get model.
*   `PUT /api/v1/user/bus-models/{model_id}`: Update model.
*   `DELETE /api/v1/user/bus-models/{model_id}`: Delete model.

### Buses
*   `GET /api/v1/user/buses/`: List buses.
*   `POST /api/v1/user/buses/`: Create bus.
*   `GET /api/v1/user/buses/{bus_id}`: Get bus.
*   `PUT /api/v1/user/buses/{bus_id}`: Update bus.
*   `DELETE /api/v1/user/buses/{bus_id}`: Delete bus.

### Depots
*   `GET /api/v1/user/depots/`: List depots.
*   `POST /api/v1/user/depots/`: Create depot.
*   `GET /api/v1/user/depots/{depot_id}`: Get depot.
*   `PUT /api/v1/user/depots/{depot_id}`: Update depot.
*   `DELETE /api/v1/user/depots/{depot_id}`: Delete depot.

### Shifts
*   `GET /api/v1/user/shifts/`: List shifts.
*   `POST /api/v1/user/shifts/`: Create shift.
*   `GET /api/v1/user/shifts/{shift_id}`: Get shift.
*   `PUT /api/v1/user/shifts/{shift_id}`: Update shift.
*   `DELETE /api/v1/user/shifts/{shift_id}`: Delete shift.

## GTFS Data (`/api/v1/gtfs`)
### Routes
*   `GET /api/v1/gtfs/gtfs-routes/`: List routes.
*   `POST /api/v1/gtfs/gtfs-routes/`: Create route.
*   `GET /api/v1/gtfs/gtfs-routes/{route_id}`: Get route.
*   `GET /api/v1/gtfs/gtfs-routes/by-agency/{agency_id}`: Get routes by agency.
*   `GET /api/v1/gtfs/gtfs-routes/by-stop/{stop_id}`: Get routes by stop.

### Trips
*   `GET /api/v1/gtfs/gtfs-trips/by-route/{route_id}`: Get trips by route.
*   `GET /api/v1/gtfs/gtfs-trips/by-stop/{stop_id}`: Get trips by stop.
*   `POST /api/v1/gtfs/gtfs-trips/`: Create trip.
*   `PUT /api/v1/gtfs/gtfs-trips/{trip_pk}`: Update trip.
*   `DELETE /api/v1/gtfs/gtfs-trips/{trip_pk}`: Delete trip.
*   `POST /api/v1/gtfs/aux-trip`: Create auxiliary trip (deadhead).

### Stops
*   `GET /api/v1/gtfs/gtfs-stops/`: List stops.
*   `POST /api/v1/gtfs/gtfs-stops/`: Create stop.
*   `GET /api/v1/gtfs/gtfs-stops/{stop_pk}`: Get stop.
*   `PUT /api/v1/gtfs/gtfs-stops/{stop_pk}`: Update stop.
*   `DELETE /api/v1/gtfs/gtfs-stops/{stop_pk}`: Delete stop.
*   `GET /api/v1/gtfs/gtfs-stops/by-trip/{trip_id}`: Get stops by trip.

### Calendar
*   `GET /api/v1/gtfs/gtfs-calendar/by-trip/{trip_id}`: Get calendar by trip.

### Variants & Elevation
*   `GET /api/v1/gtfs/variants/by-route/{route_id}`: Get variants by route.
*   `GET /api/v1/gtfs/variants/{route_id}/{variant_num}`: Get specific variant.
*   `GET /api/v1/gtfs/elevation-profile/by-trip/{trip_id}`: Get elevation profile.
*   `GET /api/v1/gtfs/osrm/driving-distance`: Get driving distance.

## Simulation (`/api/v1/simulation`)
*   `GET /api/v1/simulation/simulation-runs/`: List simulation runs.
*   `POST /api/v1/simulation/simulation-runs/`: Create simulation run.
*   `GET /api/v1/simulation/simulation-runs/{run_id}`: Get run details.
*   `PUT /api/v1/simulation/simulation-runs/{run_id}`: Update run.
*   `GET /api/v1/simulation/simulation-runs/{run_id}/results`: Get results.
*   `POST /api/v1/simulation/trip-statistics/`: Compute trip statistics.
*   `GET /api/v1/simulation/pvgis-tmy/`: Get PVGIS weather data.

## System
*   `GET /`: Root status.
*   `GET /health`: Health check.
