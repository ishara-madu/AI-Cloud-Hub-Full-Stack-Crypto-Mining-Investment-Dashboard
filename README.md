# AI Cloud Hub (Crypto Investment Platform)

AI Cloud Hub is a web-based cryptocurrency mining & package investment platform. Users can buy investment packages, claim daily login rewards, manage referral structures, and make deposits/withdrawals. The project includes a robust administrative panel for platform management and AI-driven insights.

## Tech Stack
* **Frontend**: React (v18), Vite, TypeScript, Tailwind CSS, shadcn-ui
* **Backend & Database**: Supabase (Database, Auth, Row-Level Security, Edge Functions)
* **Integrations**: NowPayments (Cryptocurrency Payment Gateway), Google Gemini API (AI-driven admin insights)
* **Package Manager**: `pnpm` (indicated by `pnpm-lock.yaml`)

---

## Getting Started

Follow these instructions to set up the project locally.

### Prerequisites
* **Node.js** (v18 or higher)
* **pnpm** (installed globally: `npm install -g pnpm`)
* **Supabase CLI** (optional, but recommended for local Edge Function testing)

### 1. Clone & Install Dependencies
Clone the repository, navigate into the project directory, and install dependencies using `pnpm`:

```sh
# Clone repository
git clone <YOUR_GIT_URL>
cd aicloudhub

# Install packages
pnpm install
```

### 2. Configure Environment Variables
Create or verify the `.env` file in the root directory and ensure the following keys are set:

```env
VITE_SUPABASE_PROJECT_ID="your_supabase_project_id"
VITE_SUPABASE_URL="https://your_supabase_project_id.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your_supabase_anon_key"
```

### 3. Setup Supabase Database
This project contains database tables, RLS policies, trigger functions, and seed data in the [supabase/migrations](file:///Users/ishara/Documents/aicloudhub/supabase/migrations) folder.

To apply migrations easily:
1. **Combine Migrations**: Run the pre-configured script to compile all migrations chronologically into a single file:
   ```sh
   pnpm run supabase:combine
   ```
   This generates the consolidated script at [supabase/combined_migrations.sql](file:///Users/ishara/Documents/aicloudhub/supabase/combined_migrations.sql).
2. **Apply Script**: Copy the contents of `combined_migrations.sql` and run it in the **SQL Editor** of your Supabase Dashboard.

### 4. Setup Supabase Edge Functions & Secrets
This project utilizes five Supabase Edge Functions under [supabase/functions](file:///Users/ishara/Documents/aicloudhub/supabase/functions):
* `admin-ai-insights` - Uses Gemini API for AI dashboards.
* `create-nowpayments-invoice` - Generates payment invoices with NowPayments API.
* `nowpayments-webhook` - Processes cryptocurrency deposit updates.
* `delete-user` - Handles user accounts deletion securely.
* `check-vpn` - Fraud prevention.

#### Required Secrets in Supabase
Set the following secrets in your Supabase project (Dashboard > Settings > API > Edge Function Secrets, or via Supabase CLI):

```sh
# Set secrets via Supabase CLI
supabase secrets set GEMINI_API_KEY="your_gemini_api_key"
supabase secrets set NOWPAYMENTS_API_KEY="your_nowpayments_merchant_api_key"
supabase secrets set NOWPAYMENTS_IPN_SECRET="your_nowpayments_ipn_signature_secret"
```

To deploy the functions, use the Supabase CLI:
```sh
supabase functions deploy --project-ref your_supabase_project_id
```

### 5. Running Locally
Run the development server locally:

```sh
pnpm dev
```

By default, the server will start on [http://localhost:8080](http://localhost:8080).

---

## Lovable Development Workflows

Changes made via Lovable will be committed automatically to this repository. If you choose to push changes directly from your preferred IDE:
1. Clone this repo and push changes. Pushed changes will be reflected in Lovable.
2. Deployment can be executed by opening [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and selecting **Share > Publish**.

