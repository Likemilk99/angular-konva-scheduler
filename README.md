# Airport Scheduler Demo (Angular 14 + Konva)

A proof-of-concept airport driver dispatcher timeline that focuses on render performance and clean state flow.

## Run

```bash
npm install
npm start
```

Then open `http://localhost:4200`.

## Highlights

- Angular 14 + RxJS in-memory state service
- Konva-rendered timeline (grid, shifts, events, status accents)
- Mock async load with `setTimeout`
- Mock realtime updates with `setInterval`
- Left driver panel + horizontally scrollable timeline
