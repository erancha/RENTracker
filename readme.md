# Preface

**RENTracker** is a property rent management app that streamlines rent agreements and activity (TBD).

The app supports two user roles: Landlords who manage properties, rental agreements, and activity (TBD), and Tenants who complete their details in the rental agreement, and manage their activity.

Designed with scalability in mind, the application employs a serverless computing, alongside global content distribution via CloudFront.

The application features an intuitive mobile-friendly design and monitoring capabilities through AWS CloudWatch. The app is developed using AWS, React, REST APIs, and WebSockets to provide real-time updates.

User authentication is securely handled through Google.

The app is available online at https://d3uo2ovuz6gcru.cloudfront.net

# Table Of Content

<!-- toc -->

- [High-Level Design (HLD) Document for RENTracker](#high-level-design-hld-document-for-rentracker)
  - [Architecture](#architecture)
    - [1. **Backend**](#1-backend)
      - [**API Gateway + Lambda**](#api-gateway--lambda)
      - [Data Model:](#data-model)
        - [1. Apartments Table](#1-apartments-table)
        - ~~[2. Landlords Table](#2-landlords-table)~~
        - ~~[3. Tenants Table](#3-tenants-table)~~
        - [4. Documents Table](#4-documents-table)
        - [5. ApartmentActivity Table](#5-apartmentActivity-table)
        - [Example of Relationships](#example-of-relationships)
      - [**SQS**](#sqs)
    - [2. **Frontend**](#2-frontend)
    - [3. **Security** Considerations](#3-security-considerations)
    - [4. **Scalability**, **Performance** and **Resiliency**](#4-scalability-performance-and-resiliency)
    - [5. Flexible **Deployment**](#5-flexible-deployment)
    - [6. **Monitoring** and **Logging**](#6-monitoring-and-logging)
      - [6.1 **AWS X-Ray**](#61-aws-x-ray)
  - [Summary](#summary)

<!-- tocstop -->

# High-Level Design (HLD) Document for RENTracker

## Architecture

**API Gateway + Lambda**
![Architecture diagram](https://lucid.app/publicSegments/view/11403d3e-caa3-4885-be91-b94764ebab83/image.jpeg)

### 1. **Backend**

The application features a hybrid architecture that provides flexible deployment options:

#### **API Gateway + Lambda**

Serverless deployment option where Lambda functions run in private subnets, using API Gateway for secure request distribution - ideal for variable workloads and pay-per-use pricing model, where costs scale with actual usage

#### Data Model:

##### 1. Apartments Table

- **saas_tenant_id** (GSI Partition Key) - Identifier for SaaS multi-tenancy.
- **apartment_id** (Partition Key) - Unique identifier for each apartment/unit (e.g., UUID).
- **landlord_id** - Identifier for the landlord who owns the apartment.
- **address** - Physical address of the apartment building/house.
- **rooms_count** - Number of rooms in the apartment.
- **unit_number** - Identifier for the specific unit within the building/house (e.g., "Apt 2B", "Unit 101").
- **rent_amount** - Monthly rent amount for the apartment.

~~##### 2. Landlords Table~~

~~- **saas_tenant_id** (GSI Partition Key) - Identifier for SaaS multi-tenancy.~~
~~- **landlord_id** (Partition Key) - Unique identifier for each landlord (e.g., UUID).~~
~~- **full_name** - Landlord's full name.~~
~~- **email** - Landlord's email address.~~
~~- **phone** - Landlord's phone number.~~

~~##### 3. Tenants Table~~

~~- **saas_tenant_id** (GSI Partition Key) - Identifier for SaaS multi-tenancy.~~
~~- **tenant_id** (Partition Key) - Unique identifier for each tenant (e.g., UUID).~~
~~- **full_name** - Tenant's full name.~~
~~- **email** - Tenant's email address.~~
~~- **phone** - Tenant's phone number.~~
~~- **apartment_id** - Identifier for the apartment/unit the tenant occupies (could link to a separate Apartments table).~~
~~- **lease_start_date** - The start date of the lease agreement.~~
~~- **lease_end_date** - The end date of the lease agreement.~~

##### 4. Documents Table

- **saas_tenant_id** (GSI Partition Key) - Identifier for SaaS multi-tenancy.
- **document_id** (Partition Key) - Unique identifier for each document (e.g., UUID).
- **apartment_id** - Identifier for the apartment associated with the document.
- **tenant_user_id** - User Id of the tenant associated with the document.
- **template_name** - Name of the template used for the document (e.g., 'rental_agreement').
- **template_fields** - JSON object containing dynamic fields for the template.
- **pdf_url** - URL of the pdf in S3.
- ~~**status** - Status of the document (e.g., draft, pending, signed, archived).~~
- **created_at** - Timestamp when the document was created.
- **updated_at** - Timestamp when the document was last modified.

##### 5. Apartment Activity Table

- **saas_tenant_id** (GSI Partition Key) - Identifier for SaaS multi-tenancy.
- **activity_id** (Partition Key) - Unique identifier for each activity (e.g., UUID).
- **apartment_id** - Identifier for the apartment associated with the activity.
- **created_at** - Date when the activity was made.
- **description** - String. Activity description, e.g. 'Payment sent for 05/2025', or 'Payment accepted for 05/2025'.
- **pending_confirmation** - Boolean. Optional. If exists and true, either the landlord or tenant (depending on initiating_user_id) must confirm.
- **confirmed_at**: - Date of confirmation.

##### Example of Relationships

- A landlord can have multiple apartments.
- A tenant can make multiple activity for their rented apartment.

#### **SQS**

- Purpose: To decouple websockets notifications from business logic in Lambda functions.

### 2. **Frontend**

- Single Page Application (SPA) developed with React
- Hosted on AWS S3
- Delivered globally via **AWS CloudFront**
- Technology stack: **React**, **Redux** (HOC), **TypeScript**

### 3. **Security** Considerations

- Data in transit is encrypted with **HTTPS**
- User authentication via AWS Cognito with **Google** integration
- Lambda functions and Elasticache Redis are in a **private subnet**
- IAM roles follow the least privilege principle
- Sensitive documents in S3 are shared via presigned URLs, which are configured with an expiration time (e.g., 2 days) to limit exposure.

### 4. **Scalability**, **Performance** and **Resiliency**

- Serverless architecture enables automatic scaling
- Elasticache Redis enhances the scalability of read operations
- CloudFront provides low-latency content delivery

### 5. **Deployment**

- Uses AWS SAM (Serverless Application Model) for deployment
- Infrastructure is defined with CloudFormation templates
- Deploy with a single command: `sam build` and `sam deploy`
- The app is available online at https://d3uo2ovuz6gcru.cloudfront.net

### 6. **Monitoring and Logging**

- **Monitoring** and **logging** via AWS CloudWatch and X-Ray

#### 6.1 **AWS X-Ray**

- **Purpose**: AWS X-Ray is used to trace requests as they travel through the application, providing insights into performance bottlenecks and service dependencies.
- **Impact on Production Performance**: Minimal impact when sampling is enabled. Sampling ensures that only a subset of requests are traced, reducing overhead.
- **Benefits**: Helps in identifying latency issues, debugging errors, and understanding the application's behavior under load.

## Summary

RENTracker's architecture utilizes AWS for a scalable, secure, and highly available backend. It supports both single-tenant and multi-tenant deployments, focusing on a robust backend.
