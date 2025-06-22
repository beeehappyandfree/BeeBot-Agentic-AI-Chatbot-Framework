import {
  MetricUnits,
  Metrics,
  logMetrics,
} from '@aws-lambda-powertools/metrics';
import { Tracer, captureLambdaHandler } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger';
import middy from '@middy/core';

const tracer = new Tracer();
const metrics = new Metrics();

interface Event {
  messageVersion: string;
  agent: {
    name: string;
    id: string;
    alias: string;
    version: string;
  };
  inputText: string;
  sessionId: string;
  actionGroup: string;
  apiPath: string;
  httpMethod: string;
  parameters: {
    name: string;
    type: string;
    value: string;
  }[];
  requestBody: {
    content: {
      [contentType: string]: {
        properties: {
          name: string;
          type: string;
          value: string;
        }[];
      };
    };
  };
  sessionAttributes: Record<string, string>;
  promptSessionAttributes: Record<string, string>;
}

interface Response {
  messageVersion: string;
  response: {
    actionGroup: string;
    apiPath: string;
    httpMethod: string;
    httpStatusCode: number;
    responseBody: {
      [contentType: string]: {
        body: string;
      };
    };
    sessionAttributes?: Record<string, string>;
    promptSessionAttributes?: Record<string, string>;
  };
}

export const adapter = async ({
  inputText,
  apiPath,
  httpMethod,
  actionGroup,
  messageVersion,
  requestBody,
  sessionAttributes,
  promptSessionAttributes,
}: Event): Promise<Response> => {
  let body;
  let httpStatusCode = 200;

  try {
    console.info(
      `inputText: ${inputText}, apiPath: ${apiPath}, httpMethod: ${httpMethod}`
    );

    switch (apiPath) {
      case '/getCurrentTime':
        if (httpMethod === 'GET') {
          body = {
            currentTime: new Date().toISOString()
          };
        }
        break;

      default:
        httpStatusCode = 500;
        body = 'Sorry, I am unable to help you with that. Please try asking the question in a different way perhaps.';
        break;
    }

    metrics.addMetric('SuccessfulActionGroupQuery', MetricUnits.Count, 1);

    return {
      messageVersion,
      response: {
        apiPath,
        actionGroup,
        httpMethod,
        httpStatusCode,
        sessionAttributes,
        promptSessionAttributes,
        responseBody: {
          'application/json': {
            body: JSON.stringify(body),
          },
        },
      },
    };
  } catch (error) {
    let errorMessage = 'Unknown error';
    if (error instanceof Error) errorMessage = error.message;
    console.error(errorMessage);

    metrics.addMetric('ActionGroupQueryError', MetricUnits.Count, 1);

    throw error;
  }
};

export const handler = middy(adapter)
  .use(captureLambdaHandler(tracer))
  .use(logMetrics(metrics));
