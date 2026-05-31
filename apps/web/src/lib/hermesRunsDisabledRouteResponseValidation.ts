export const HERMES_RUNS_DISABLED_ROUTE_HTTP_STATUS = 501;
export const HERMES_RUNS_DISABLED_ROUTE_REASON = "production_runs_route_not_enabled";
export const HERMES_RUNS_DISABLED_ROUTE_PATH = "/api/hermes/runs/chat/stream";
export const HERMES_RUNS_SESSION_STREAM_ROUTE_PATH = "/api/hermes/chat/stream";
export const HERMES_RUNS_EXPERIMENTAL_ROUTE_PATH = "/api/hermes/runs/experimental-chat";

export type HermesRunsDisabledRouteResponseValidationOptions = {
  expectedErrorKinds?: string[];
  expectedRequestValidationOk?: boolean;
  httpStatus?: number;
};

export type HermesRunsDisabledRouteResponseValidationResult =
  | {
      errors: [];
      ok: true;
    }
  | {
      errors: string[];
      ok: false;
    };

export function validateHermesRunsDisabledRouteResponse(
  response: unknown,
  options: HermesRunsDisabledRouteResponseValidationOptions = {}
): HermesRunsDisabledRouteResponseValidationResult {
  const errors: string[] = [];

  if (options.httpStatus !== undefined && options.httpStatus !== HERMES_RUNS_DISABLED_ROUTE_HTTP_STATUS) {
    errors.push(`expected HTTP ${HERMES_RUNS_DISABLED_ROUTE_HTTP_STATUS}`);
  }

  if (!isRecord(response)) {
    return failure(["response must be a JSON object"]);
  }

  expectEqual(response.ok, false, "ok", errors);
  expectEqual(response.mode, "disabled", "mode", errors);
  expectEqual(response.route, HERMES_RUNS_DISABLED_ROUTE_PATH, "route", errors);
  expectEqual(response.reason, HERMES_RUNS_DISABLED_ROUTE_REASON, "reason", errors);
  expectEqual(response.status, "not_implemented", "status", errors);
  expectEqual(response.sessionStreamDefault, true, "sessionStreamDefault", errors);
  expectEqual(response.sessionStreamRoute, HERMES_RUNS_SESSION_STREAM_ROUTE_PATH, "sessionStreamRoute", errors);
  expectEqual(response.experimentalRoute, HERMES_RUNS_EXPERIMENTAL_ROUTE_PATH, "experimentalRoute", errors);
  expectEqual(response.productionChatUntouched, true, "productionChatUntouched", errors);
  expectEqual(response.agentAccessSelector, "future-only", "agentAccessSelector", errors);

  for (const key of [
    "hermesRunCreated",
    "hermesCalled",
    "brainMemoryCalled",
    "eventStreamStarted",
    "directBrowserHermes",
    "directBrowserBrainMemory",
    "directStorageAccess",
    "approvalCalled",
    "stopCalled",
    "composerRunsSwitch"
  ]) {
    expectEqual(response[key], false, key, errors);
  }

  validateExecutionPosture(response.execution, errors);
  validateRequestValidationPosture(response.requestValidation, options, errors);
  validateLifecycleDryRunPosture(response.lifecycleDryRun, errors);
  validateNoRuntimeIds(response, errors);
  validateNoSecretLikeData(response, errors);

  return errors.length === 0 ? { errors: [], ok: true } : failure(errors);
}

function validateExecutionPosture(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push("execution must be an object");
    return;
  }

  for (const key of [
    "hermesRunCreated",
    "hermesCalled",
    "brainMemoryCalled",
    "eventStreamStarted",
    "approvalCalled",
    "stopCalled",
    "storageAccess"
  ]) {
    expectEqual(value[key], false, `execution.${key}`, errors);
  }
}

function validateRequestValidationPosture(
  value: unknown,
  options: HermesRunsDisabledRouteResponseValidationOptions,
  errors: string[]
) {
  if (!isRecord(value)) {
    errors.push("requestValidation must be an object");
    return;
  }

  expectEqual(value.attempted, true, "requestValidation.attempted", errors);
  expectEqual(value.rawRequestEchoed, false, "requestValidation.rawRequestEchoed", errors);

  if (options.expectedRequestValidationOk !== undefined) {
    expectEqual(value.ok, options.expectedRequestValidationOk, "requestValidation.ok", errors);
  }

  if (!Array.isArray(value.errorKinds)) {
    errors.push("requestValidation.errorKinds must be an array");
  } else {
    for (const expected of options.expectedErrorKinds ?? []) {
      if (!value.errorKinds.includes(expected)) {
        errors.push(`requestValidation.errorKinds must include ${expected}`);
      }
    }
  }

  if (!Array.isArray(value.errors)) {
    errors.push("requestValidation.errors must be an array");
  } else if (
    value.errors.some((item) => !isRecord(item) || typeof item.kind !== "string" || typeof item.path !== "string")
  ) {
    errors.push("requestValidation.errors must contain only redacted kind/path objects");
  }

  const futureFields = value.futureFields;
  if (!isRecord(futureFields)) {
    errors.push("requestValidation.futureFields must be an object");
    return;
  }
  expectEqual(futureFields.agentAccessMode, "metadata_only", "requestValidation.futureFields.agentAccessMode", errors);
  expectEqual(
    futureFields.model,
    "inert_until_client_selectable",
    "requestValidation.futureFields.model",
    errors
  );
  expectEqual(futureFields.provider, "inert_until_supported", "requestValidation.futureFields.provider", errors);
}

function validateLifecycleDryRunPosture(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push("lifecycleDryRun must be an object");
    return;
  }

  expectEqual(value.disabledReason, HERMES_RUNS_DISABLED_ROUTE_REASON, "lifecycleDryRun.disabledReason", errors);
  expectEqual(value.routeStatus, "disabled_http_501", "lifecycleDryRun.routeStatus", errors);
  expectEqual(value.productionChatRoute, HERMES_RUNS_SESSION_STREAM_ROUTE_PATH, "lifecycleDryRun.productionChatRoute", errors);
  expectEqual(value.productionRunsRoute, HERMES_RUNS_DISABLED_ROUTE_PATH, "lifecycleDryRun.productionRunsRoute", errors);
  expectEqual(value.rawRequestEchoed, false, "lifecycleDryRun.rawRequestEchoed", errors);
  expectEqual(value.serviceSecretsRead, false, "lifecycleDryRun.serviceSecretsRead", errors);

  validateLifecycleRuntimeExecution(value.runtimeExecution, errors);

  if (!Array.isArray(value.stages)) {
    errors.push("lifecycleDryRun.stages must be an array");
    return;
  }

  const createRunStage = value.stages.find((stage) => isRecord(stage) && stage.stage === "create_run");
  if (!isRecord(createRunStage) || createRunStage.executed !== false) {
    errors.push("lifecycleDryRun create_run stage must be present and not executed");
  }

  const invalidRuntimeStage = value.stages.find(
    (stage) => isRecord(stage) && stage.stage !== "validate_request" && stage.executed !== false
  );
  if (invalidRuntimeStage) {
    errors.push("lifecycleDryRun runtime stages must not be executed");
  }
}

function validateLifecycleRuntimeExecution(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push("lifecycleDryRun.runtimeExecution must be an object");
    return;
  }

  for (const key of [
    "hermesRunCreated",
    "hermesCalled",
    "brainMemoryCalled",
    "eventStreamStarted",
    "runRecordCreated",
    "activityReplayUpdated",
    "approvalCalled",
    "stopCalled",
    "storageAccess"
  ]) {
    expectEqual(value[key], false, `lifecycleDryRun.runtimeExecution.${key}`, errors);
  }
}

function validateNoRuntimeIds(response: Record<string, unknown>, errors: string[]) {
  for (const key of ["runId", "hermesRunId", "eventStream", "stream", "approvalButtons", "approvalActions"]) {
    if (key in response) {
      errors.push(`disabled response must not include ${key}`);
    }
  }
}

function validateNoSecretLikeData(response: unknown, errors: string[]) {
  const serialized = JSON.stringify(response);
  const secretPattern = /Bearer\s+[A-Za-z0-9._~+/=-]+|sk-[A-Za-z0-9_-]+|password["']?\s*:|authorization["']?\s*:/i;

  if (secretPattern.test(serialized)) {
    errors.push("disabled response must not contain secret-like data");
  }
}

function expectEqual(actual: unknown, expected: unknown, label: string, errors: string[]) {
  if (actual !== expected) {
    errors.push(`${label} must be ${JSON.stringify(expected)}`);
  }
}

function failure(errors: string[]): HermesRunsDisabledRouteResponseValidationResult {
  return { errors, ok: false };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
