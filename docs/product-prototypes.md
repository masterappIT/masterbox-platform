# MasterBox Product References

This document consolidates the useful product notes found in local legacy projects. The source prototypes remain outside the canonical repository and are not runtime dependencies.

## MasterApp website

The legacy website prototype corresponds to <https://masterappinc.com/> and referenced an Adobe XD design at <https://xd.adobe.com/view/dbce8825-d038-4ff6-8fb7-86a41500d30b-8e9d/grid>. Its Sass workflow was:

```bash
cd style/scss
npx sass --watch index.scss ../css/index.css
```

This is a historical design reference, not a current deployment instruction.

## EC Travel prototype

The standalone Flutter prototype documented these product flows:

- Passenger home, map, route setup, vehicle selection, order confirmation, driver search and cancellation
- Trips and profile
- Login and Google-login placeholder
- Driver application and document-upload placeholder
- Driver dashboard and nearby orders
- Vehicle services, notifications, support and settings

The prototype used self-contained Material UI and painted map placeholders. It did not provide a production API contract, credentials or backend integration. Do not copy its placeholder authentication, upload or map behavior into the MasterBox chat platform without a separate product decision.

## Legacy implementation notes

Historical webhook development used Node.js, dotenv and lowerCamelCase naming conventions. Current backend conventions and commands are defined in [Backend README](../backend/README.md); this note is retained only for migration history.
