import boto3
import json
import logging
from typing import Dict, Any
import os

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
bedrock_client = boto3.client('bedrock-agent-runtime')  # Use bedrock-agent-runtime for agent operations
bedrock_agent_client = boto3.client('bedrock-agent')    # Use bedrock-agent for agent management
s3_client = boto3.client('s3')

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda function to handle S3 events and sync documents to Bedrock Knowledge Base.
    
    This function is triggered when new documents are uploaded to the S3 bucket.
    It automatically starts an ingestion job to sync the new documents to the Bedrock Knowledge Base.
    """
    try:
        logger.info(f"Received event: {json.dumps(event)}")
        
        # Extract S3 event information
        s3_event = event.get('Records', [{}])[0].get('s3', {})
        bucket_name = s3_event.get('bucket', {}).get('name')
        object_key = s3_event.get('object', {}).get('key')
        
        logger.info(f"Processing S3 event - Bucket: {bucket_name}, Key: {object_key}")
        
        # Get environment variables for Knowledge Base and Data Source IDs
        knowledge_base_id = os.environ.get('KNOWLEDGE_BASE_ID')
        data_source_id = os.environ.get('DATA_SOURCE_ID')
        
        # Validate required parameters
        if not knowledge_base_id or not data_source_id:
            error_msg = f"Missing required environment variables. Knowledge Base ID: {knowledge_base_id}, Data Source ID: {data_source_id}"
            logger.error(error_msg)
            return {
                'statusCode': 400,
                'body': json.dumps({'error': error_msg})
            }
        
        # Check if the uploaded file is a supported document type
        supported_extensions = ['.pdf', '.txt', '.docx', '.md', '.json']
        file_extension = object_key.lower().split('.')[-1] if '.' in object_key else ''
        
        if file_extension not in [ext.replace('.', '') for ext in supported_extensions]:
            logger.info(f"Skipping file {object_key} - unsupported file type: {file_extension}")
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': f'Skipped unsupported file type: {file_extension}',
                    'file': object_key
                })
            }
        
        # Start ingestion job to sync the new document
        logger.info(f"Starting ingestion job for Knowledge Base: {knowledge_base_id}, Data Source: {data_source_id}")
        
        try:
            # Try using the bedrock-agent service first
            response = bedrock_agent_client.start_ingestion_job(
                dataSourceId=data_source_id,
                knowledgeBaseId=knowledge_base_id
            )
            
            ingestion_job_id = response.get('ingestionJob', {}).get('ingestionJobId')
            logger.info(f"Successfully started ingestion job: {ingestion_job_id}")
            
        except Exception as bedrock_error:
            logger.error(f"Bedrock API error: {str(bedrock_error)}")
            logger.error(f"Error type: {type(bedrock_error).__name__}")
            
            # If bedrock-agent fails, try the regular bedrock service
            try:
                logger.info("Trying with bedrock service...")
                bedrock_regular_client = boto3.client('bedrock')
                response = bedrock_regular_client.start_ingestion_job(
                    dataSourceId=data_source_id,
                    knowledgeBaseId=knowledge_base_id
                )
                
                ingestion_job_id = response.get('ingestionJob', {}).get('ingestionJobId')
                logger.info(f"Successfully started ingestion job with bedrock service: {ingestion_job_id}")
                
            except Exception as bedrock_regular_error:
                logger.error(f"Bedrock regular service error: {str(bedrock_regular_error)}")
                raise bedrock_regular_error
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Document sync initiated successfully',
                'ingestionJobId': ingestion_job_id,
                'file': object_key,
                'bucket': bucket_name
            })
        }
        
    except Exception as e:
        error_msg = f"Error processing S3 event: {str(e)}"
        logger.error(error_msg)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': error_msg})
        }