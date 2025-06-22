const sanitizeName = (name: string): string => {
    const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '_');
    return sanitizedName.match(/^[a-zA-Z]+$/) ? sanitizedName : `kb_${sanitizedName}`;
};

const timestamp = new Date().toISOString().replace(/[:\-\.]/g, '').slice(0, 14);

const bundleConfig = {
    forceDockerBundling: false,
    minify: true,
    sourceMap: true,
    target: "es2020",
    esbuildArgs: {
        '--platform': 'node',
    },
    nodeModules: [
        "dotenv"
    ]
}

const lambdaConfig = (serviceName: string, metricNamespace: string) => {
    return {
        LOG_LEVEL: 'DEBUG',
        POWERTOOLS_LOGGER_LOG_EVENT: 'true',
        POWERTOOLS_LOGGER_SAMPLE_RATE: '1',
        POWERTOOLS_TRACE_ENABLED: 'enabled',
        POWERTOOLS_TRACER_CAPTURE_HTTPS_REQUESTS: 'captureHTTPsRequests',
        POWERTOOLS_SERVICE_NAME: serviceName,
        POWERTOOLS_TRACER_CAPTURE_RESPONSE: 'captureResult',
        POWERTOOLS_METRICS_NAMESPACE: metricNamespace,
    }
}

export default {
    sanitizeName,
    timestamp,
    bundleConfig,
    lambdaConfig
}

export {
    sanitizeName,
    timestamp,
    bundleConfig,
    lambdaConfig
}