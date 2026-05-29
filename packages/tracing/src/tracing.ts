import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { TraceIdRatioBasedSampler, ParentBasedSampler } from '@opentelemetry/sdk-trace-node';

export function initTracing(serviceName: string): NodeSDK | null {
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  if (!otlpEndpoint) {
    console.log(`[Tracing] OTEL_EXPORTER_OTLP_ENDPOINT not set — tracing disabled for ${serviceName}`);
    return null;
  }

  const samplingRatio = parseFloat(process.env.OTEL_SAMPLING_RATIO ?? '0.1');
  const sampler = new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(samplingRatio),
  });

  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${otlpEndpoint}/v1/traces`,
    }),
    sampler,
    instrumentations: [
      new HttpInstrumentation(),
      new NestInstrumentation(),
    ],
  });

  sdk.start();
  console.log(`[Tracing] OpenTelemetry initialized for ${serviceName} → ${otlpEndpoint} (sampling: ${samplingRatio * 100}%)`);

  process.on('SIGTERM', () => sdk.shutdown());

  return sdk;
}
