# @crazyglegit/support-storage-s3

Private AWS S3/MinIO-compatible storage adapter for Support Kit attachments.

The package exports only `createS3StorageAdapter`, `S3StorageAdapter`, and `S3StorageAdapterOptions`. It does not export AWS clients, commands, signing utilities, bucket administration, or object-key helpers.

See [attachment integration](../../docs/integration/attachments.md) for configuration, private-bucket CORS, encryption, local MinIO, lifecycle, and troubleshooting guidance.
