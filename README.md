# OpenTelemetry API Developer Portal POC

A starter Next.js App Router application for testing server-side OpenTelemetry with Elastic EDOT Node.js, Cognito authentication, DynamoDB configuration storage, and ECS Fargate hosting.

## Scope

- Cognito Hosted UI sign-in (OAuth authorization-code flow through Amplify)
- Server-side verification of Cognito access tokens
- Create API configuration as `DRAFT`
- Publish configuration by changing its state to `PUBLISHED`
- DynamoDB persistence
- Custom OpenTelemetry spans for create, validation, save, publish, and database operations
- EDOT Node.js preloaded before the Next.js server starts

This POC publishes configuration metadata only. It does not create a real API Gateway route.

## 1. Prerequisites

- Node.js 22+
- AWS account and credentials for local development
- Cognito User Pool and app client configured for Authorization Code Grant
- Elastic Cloud OTLP endpoint and API key
- DynamoDB table

## 2. Create DynamoDB table

Create a table named `ApiPortalConfigurations` with partition key:

- `apiId` (String)

For a POC, the table has no sort key. The code uses `Scan` for list and duplicate-path checks for simplicity. Do not use this design at production scale: add a GSI for `createdBy` and a separate base-path uniqueness strategy (for example, a conditional reservation item or transaction).

## 3. Configure Cognito

In the Cognito User Pool:
1. Create an app client without a client secret for the browser-based public client.
2. Enable OAuth 2.0 authorization code grant and scopes `openid`, `email`, `profile`.
3. Configure callback URL `http://localhost:3000/` for local development and your HTTPS app URL for deployed use.
4. Configure sign-out URL to the same URL.
5. Set the Hosted UI domain.
6. Create a test user and verify email/password settings.

For this starter, the browser gets an access token from Amplify and sends it as a bearer token. The server verifies it with `aws-jwt-verify`. Never trust a user ID sent in the request body.

## 4. Install and configure

```bash
cp .env.example .env.local
npm install
npm run dev
```

Replace all Cognito and Elastic placeholders. For local development, ensure AWS credentials are available through your normal AWS profile or environment. Do not commit `.env.local`.

The Cognito domain value should be the hostname only, without `https://`.

The `OTEL_EXPORTER_OTLP_HEADERS` value must use an Elastic API key in the format expected by Elastic. Elastic's example uses a base64-encoded API key value. Copy the correct value and endpoint from the Elastic deployment's OTLP setup instructions; don't use an Elasticsearch REST API endpoint in place of the OTLP ingest endpoint.

## 5. Verify the flow

1. Open the app and sign in.
2. Create an API draft.
3. Publish it.
4. In Elastic Observability, open Applications / Service Inventory and find `api-developer-portal`.
5. Open a trace and inspect spans:
   - `portal.api.create`
   - `portal.api.validate`
   - `portal.api.save`
   - `portal.api.publish`
   - `portal.api.load_for_publish`
   - `portal.api.validate_for_publish`
   - `portal.api.persist_publication`

Automatic HTTP and AWS SDK spans depend on supported library versions and EDOT instrumentation. Check the actual trace before assuming every operation is auto-instrumented.

## 6. Elastic environment variables

Set these on the ECS task definition (prefer Secrets Manager for the API key):

- `OTEL_SERVICE_NAME=api-developer-portal`
- `OTEL_RESOURCE_ATTRIBUTES=service.version=0.1.0,deployment.environment.name=dev`
- `OTEL_EXPORTER_OTLP_ENDPOINT=<Elastic OTLP endpoint>`
- `OTEL_EXPORTER_OTLP_HEADERS=Authorization=ApiKey <Elastic API key value>`

Use the exact header encoding specified by your Elastic deployment's OTLP instructions. Avoid putting the API key in the Docker image or source control.

## 7. ECS Fargate deployment outline

1. Build and push the image to Amazon ECR.
2. Create an ECS task execution role for image pulls and CloudWatch container logs.
3. Create an ECS task role with least-privilege `dynamodb:GetItem`, `PutItem`, `UpdateItem`, and `Scan` on the table. The current POC uses Scan, so this permission is needed; remove Scan after redesigning the access pattern.
4. Store the Elastic API key in AWS Secrets Manager and inject it as a task-definition secret.
5. Configure task networking so the task can reach DynamoDB and the Elastic OTLP HTTPS endpoint. Use a DynamoDB gateway endpoint if tasks are in private subnets; provide NAT or another approved egress path for Elastic if direct connectivity is required.
6. Place the service behind an HTTPS Application Load Balancer.
7. Set health checks to `/` or add a dedicated `/api/health` route.
8. Configure desired count and deployment circuit breaker/rollback.
9. Confirm telemetry reaches Elastic after deploying.

### Build and push (example)

```bash
docker build -t api-developer-portal:0.1.0 .
aws ecr get-login-password --region ap-southeast-1 \
  | docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-southeast-1.amazonaws.com
docker tag api-developer-portal:0.1.0 <account-id>.dkr.ecr.ap-southeast-1.amazonaws.com/api-developer-portal:0.1.0
docker push <account-id>.dkr.ecr.ap-southeast-1.amazonaws.com/api-developer-portal:0.1.0
```

## 8. POC hardening before production

- Replace `Scan` calls with indexed access patterns.
- Enforce base-path uniqueness atomically; current duplicate scan is race-prone.
- Add rate limiting, CSRF/origin controls as appropriate, and stronger API input validation.
- Do not record bearer tokens, cookies, API keys, full request bodies, or sensitive query parameters in telemetry.
- Add a real publish workflow with idempotency and rollback if provisioning gateway resources.
- Add a dedicated health endpoint and structured application logging.
- Consider browser RUM as a separate step; this starter focuses on server-side distributed tracing.
- Test failure cases and verify trace propagation through browser request -> Next.js route -> DynamoDB SDK.
- Validate current package versions and SDK compatibility in CI before production deployment.
