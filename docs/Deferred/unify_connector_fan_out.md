# Unify Connector Fan-Out

Bundle-authority-correct: lift per-connector endpoint-offset distribution into the shared routingCore (or a shared helper it consumes), so all renderers — including ui_contracts — get fan-out from one place. This is the direction the repo's stated constraints point toward, but it's a larger, cross-renderer change.