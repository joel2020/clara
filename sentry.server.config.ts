import * as Sentry from "@sentry/nextjs";
import { createSentryOptions } from "./lib/observability";

const options = createSentryOptions(process.env.SENTRY_DSN);
if (options) Sentry.init(options);
