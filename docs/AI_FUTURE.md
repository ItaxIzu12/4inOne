# 4inOne — Optional AI Direction

AI is not required for the core product and should not become a separate novelty feature.

## Useful future roles

Potential high-value assistance:

- classify/categorize receipt or transaction text;
- extract tasks/events from natural language;
- summarize what matters today;
- suggest possible connections;
- identify budget anomalies or savings-goal drift;
- classify documents/photos;
- draft packing lists from trip context.

## Local/private models

A future local or self-hosted open model may be appropriate for privacy-sensitive tasks.

Training a model from scratch is not the default plan. Prefer:

- existing open models;
- retrieval/context;
- deterministic rules;
- tools/services behind Django;
- optional fine-tuning only if evidence justifies it.

## Architecture principle

```text
Angular
  ↓
Django authorization/business layer
  ↓
AI service/local model
```

The AI service must not become an authorization bypass or independently mutate persistent data without backend validation.

## Explainability

For user-facing suggestions, show a human-understandable reason.

Bad:

> “AI detected an action.”

Better:

> “Deine Reise beginnt in 5 Tagen und es gibt noch keine Packliste. Möchtest du eine erstellen?”

## Safety

Do not let model output directly execute destructive/high-impact actions.

Validate proposed actions against typed backend schemas and permissions.
