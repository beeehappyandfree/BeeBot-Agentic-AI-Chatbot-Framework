import {
  MetricUnits,
  Metrics,
  logMetrics,
} from '@aws-lambda-powertools/metrics';
import { Tracer, captureLambdaHandler } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger';
import middy from '@middy/core';
import axios from 'axios';

const tracer = new Tracer();
const metrics = new Metrics();

// Hacker News API endpoints
const TOP_STORIES_URL = 'https://hacker-news.firebaseio.com/v0/topstories.json?print=pretty';
const ITEM_URL = 'https://hacker-news.firebaseio.com/v0/item/';

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

interface HackerNewsArticle {
  by: string;
  descendants: number;
  id: number;
  kids: number[];
  score: number;
  time: number;
  title: string;
  type: string;
  url: string;
}

export const adapter = async ({
  inputText,
  apiPath,
  httpMethod,
  actionGroup,
  messageVersion,
  parameters,
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
      case '/getTopStories':
        if (httpMethod === 'GET') {
          // Get limit parameter or default to 10
          const limitParam = parameters.find(param => param.name === 'limit');
          const limit = limitParam ? parseInt(limitParam.value, 10) : 10;
          
          // Fetch top stories from Hacker News API
          const response = await axios.get<number[]>(TOP_STORIES_URL);
          const stories = response.data.slice(0, limit);
          
          body = { stories };
        }
        break;

      case '/getArticle':
        if (httpMethod === 'GET') {
          // Get article ID parameter
          const idParam = parameters.find(param => param.name === 'id');
          
          if (!idParam) {
            httpStatusCode = 400;
            body = { error: 'Article ID is required' };
            break;
          }
          
          const articleId = parseInt(idParam.value, 10);
          
          // Fetch article details from Hacker News API
          const response = await axios.get<HackerNewsArticle>(`${ITEM_URL}${articleId}.json?print=pretty`);
          
          if (!response.data) {
            httpStatusCode = 404;
            body = { error: 'Article not found' };
            break;
          }
          
          body = response.data;
        }
        break;

      default:
        httpStatusCode = 500;
        body = {
          error: 'Sorry, I am unable to help you with that. Please try asking the question in a different way perhaps.'
        };
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
