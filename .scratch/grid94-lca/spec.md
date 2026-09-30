# Grid94 and parameterized LCA

Implement the author-approved fixed 94% grid-to-bus assessment, without changing DC optimization or energy models. Annual views and comparisons use the versioned backend `/lca` endpoint. Mileage changes recalculate inventories in the backend; unavailable/incomplete LCA does not disable energy or costs. Preserve the old endpoint for historic API users, without UI fallback. Display DC charging and derived AC connection boundaries in four languages, export provenance, and verify browser flows before coordinated release.

No model deployment, retraining or SOC change belongs to this work. Production cutover uses tested immutable images; rollback retains prior images and data.
