# Table Of Content

<!-- toc -->

- [Preface](#preface)
- [High-Level Design (HLD)](#high-level-design-hld)
  - [Architecture Diagram](#architecture-diagram)
  - [Overview](#overview)
  - [Frontend](#frontend)
  - [Backend](#backend)
  - [Non-functional attributes](#non-functional-attributes)
    - [Security](#security)
    - [Scalability, Performance and Resiliency](#scalability-performance-and-resiliency)
    - [Deployment](#deployment)
    - [Monitoring and Logging](#monitoring-and-logging)
  - [Data Model](#data-model)

<!-- tocstop -->

# Preface

**RENTracker** is a property rental tracking app that streamlines rental agreements and activity management.

The app supports two user roles:

- Landlords who manage properties and rental agreements
- Tenants who complete their details and sign agreements

# High-Level Design (HLD)

## Architecture Diagram

![Architecture diagram](https://lucid.app/publicSegments/view/568892b6-6a77-4fd4-96c6-d3dffac3c9af/image.jpeg)

## Overview

Designed with scalability in mind, the application employs:

- AWS serverless computing and storage with ElastiCache Redis for distributed caching
- Global content distribution via CloudFront
- Comprehensive monitoring through AWS CloudWatch and X-Ray
- Real-time updates via WebSockets

Built as a SaaS solution using the Pool Model (Fully Shared), where all tenants share the same infrastructure and database with data separation through tenant IDs (in this context, referring to SaaS customers, not to be confused with properties rental tenants, as described above).

The app features an intuitive mobile-friendly design.

User authentication is securely handled through Google.

The app is available online at https://d3foa0cm4szuix.cloudfront.net

## Frontend

- Single Page Application (SPA) developed with React
- Hosted on AWS S3
- Delivered globally via **AWS CloudFront**
- Technology stack: **React**, **Redux**, **TypeScript**

## Backend

- Frontend communicates with backend through API Gateway over both REST APIs and WebSocket connections
- All requests (REST and WebSocket) are processed by Lambda functions
- Data is persisted in S3 and DynamoDB with ElastiCache Redis for improved read performance
- SQS queues handle WebSocket notifications asynchronously, allowing Lambda functions in private subnets to process data requests immediately without waiting for notification delivery. In addition, the lambda function processing the queue is also responsible to send emails via SES, to publish to EventBridge, and to handle CloudFront cache invalidation when needed.

## Non-functional attributes

### Security

- Data in transit is encrypted with HTTPS
- User authentication via AWS Cognito with **Google integration**
- Lambda functions and Elasticache Redis are in **private subnet**s
- IAM roles follow the least privilege principle
- Sensitive documents in S3 are shared via presigned URLs, which are configured with an expiration time (e.g., 1 day) to limit exposure.

### Scalability, Performance and Resiliency

- Serverless architecture enables automatic scaling
- Elasticache Redis enhances the scalability of read operations
- CloudFront provides low-latency content delivery

### Deployment

- Uses AWS SAM (Serverless Application Model) for deployment
- Infrastructure is defined with CloudFormation templates
- Deploy with a single command: `sam build` and `sam deploy`
- The app is available online at https://d3foa0cm4szuix.cloudfront.net

- **SaaS Capabilities**:
  - Multi-tenant architecture using Pool Model (Fully Shared)
  - Self-service onboarding for landlords (and each landlord's tenants).
  - Centralized cloud-based delivery
  - Automatic updates and maintenance
  - Note: Currently free to use (no subscription model implemented)

### Monitoring and Logging

- **Monitoring** and **logging** via AWS CloudWatch and X-Ray

**AWS X-Ray**

- **Purpose**: AWS X-Ray is used to trace requests as they travel through the application, providing insights into performance bottlenecks and service dependencies.
- **Impact on Production Performance**: Minimal impact when sampling is enabled. Sampling ensures that only a subset of requests are traced, reducing overhead.
- **Benefits**: Helps in identifying latency issues, debugging errors, and understanding the application's behavior under load.

## Data Model

**1. SaaS Tenants Table**:

- **saas_tenant_id** (Partition Key) - Identifier for SaaS multi-tenancy.
- **name**
- **email**
- **phone**
- **address**
- **is_disabled** - If disabled, the landlord account is no longer active.

**2. Apartments Table**:

- **saas_tenant_id** (GSI Partition Key) - Identifier for SaaS multi-tenancy.
- **apartment_id** (Partition Key) - Unique identifier for each apartment/unit (e.g., UUID).
- **address** - Physical address of the apartment building/house.
- **rooms_count** - Number of rooms in the apartment.
- **unit_number** - Identifier for the specific unit within the building/house (e.g., "Apt 2B", "Unit 101").
- **rent_amount** - Monthly rent amount for the apartment.

**3. Documents Table**:

- **saas_tenant_id** (GSI Partition Key) - Identifier for SaaS multi-tenancy.
- **document_id** (Partition Key) - Unique identifier for each document (e.g., UUID).
- **apartment_id** - Identifier for the apartment associated with the document.
- **tenant_user_id** - User Id of the tenant associated with the document.
- **template_name** - Name of the template used for the document (e.g., 'rental_agreement').
- **template_fields** - JSON object containing dynamic fields for the template.
- **pdf_url** - URL of the pdf in S3.
- **created_at** - Timestamp when the document was created.
- **updated_at** - Timestamp when the document was last modified.

**4. Apartment Activity Table**:

- **saas_tenant_id** (GSI Partition Key) - Identifier for SaaS multi-tenancy.
- **activity_id** (Partition Key) - Unique identifier for each activity (e.g., UUID).
- **apartment_id** - Identifier for the apartment associated with the activity.
- **created_at** - Date when the activity was made.
- **description** - String. Activity description, e.g. 'Payment sent for 05/2025', or 'Payment accepted for 05/2025'.
- **pending_confirmation** - Boolean. Optional. If exists and true, either the landlord or tenant (depending on initiating_user_id) must confirm.
- **confirmed_at**: - Date of confirmation.

**Example of Relationships**:

- A landlord can have multiple apartments.
- A tenant can sign rental agreements on apartments of multiple landlords (probably not simultaneously...).
