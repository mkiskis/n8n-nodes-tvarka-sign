import {
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestOptions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

const API = 'https://sign-api.tvarka.pro';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function identifier(ctx: IExecuteFunctions, value: string, label: string, i: number): string {
	if (!uuid.test(value))
		throw new NodeOperationError(ctx.getNode(), `${label} must be a UUID`, { itemIndex: i });
	return value;
}

async function request(
	ctx: IExecuteFunctions,
	method: IHttpRequestOptions['method'],
	path: string,
	options: Partial<IHttpRequestOptions> = {},
): Promise<IDataObject> {
	return (await ctx.helpers.httpRequestWithAuthentication.call(ctx, 'tvarkaSignApi', {
		method,
		url: `${API}${path}`,
		json: true,
		timeout: 120000,
		disableFollowRedirect: true,
		...options,
	})) as IDataObject;
}

export class TvarkaSign implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TVARKA Sign',
		name: 'tvarkaSign',
		icon: { light: 'file:tvarka.svg', dark: 'file:tvarka.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Create and manage qualified electronic signature workflows with TVARKA',
		defaults: { name: 'TVARKA Sign' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'tvarkaSignApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				default: 'signing',
				options: [
					{ name: 'File', value: 'file' },
					{ name: 'Signing', value: 'signing' },
				],
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'upload',
				displayOptions: { show: { resource: ['file'] } },
				options: [
					{
						name: 'Upload',
						value: 'upload',
						action: 'Upload a file',
						description: 'Upload n8n binary data for use in a signing',
					},
				],
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['signing'] } },
				default: 'create',
				options: [
					{
						name: 'Cancel Signing',
						value: 'cancel',
						action: 'Cancel a signing',
						description: 'Retract outstanding signing invitations',
					},
					{
						name: 'Create Signing',
						value: 'create',
						action: 'Create a signing',
						description: 'Request signatures on an uploaded document',
					},
					{
						name: 'Download Document',
						value: 'download',
						action: 'Download a document',
						description: 'Download the latest document as binary data',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get many signings',
						description: 'Retrieve signing requests with cursor pagination',
					},
					{
						name: 'Get Signing',
						value: 'get',
						action: 'Get a signing',
						description: 'Get status and ceremony links',
					},
					{
						name: 'Remind Signer',
						value: 'remind',
						action: 'Remind a signer',
						description: 'Send a reminder through TVARKA',
					},
				],
			},
			{
				displayName: 'Input Binary Field',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: { show: { operation: ['upload'] } },
				description: 'The input binary field containing the document to upload (up to 100 MB)',
			},
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['upload'] } },
				description: 'Filename including extension. Leave empty to use the input binary filename.',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['create'] } },
				description: 'Title shown to signers',
			},
			{
				displayName: 'File Token',
				name: 'fileToken',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				required: true,
				displayOptions: { show: { operation: ['create'] } },
				description: 'Token returned by Upload File. Uploads expire after seven days.',
			},
			{
				displayName: 'Document Name',
				name: 'documentName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['create'] } },
				description: 'Filename with the same extension as the uploaded document',
			},
			{
				displayName: 'Idempotency Key',
				name: 'idempotencyKey',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['create'] } },
				description:
					'Unique business request key (1–128 ASCII characters). Reuse it when retrying the same request to prevent duplicate signings.',
			},
			{
				displayName: 'Signers',
				name: 'signers',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				placeholder: 'Add Signer',
				displayOptions: { show: { operation: ['create'] } },
				options: [
					{
						name: 'signer',
						displayName: 'Signer',
						values: [
							{
								displayName: 'Email',
								name: 'email',
								type: 'string',
								placeholder: 'name@example.com',
								default: '',
								required: true,
							},
							{ displayName: 'Name', name: 'name', type: 'string', default: '' },
							{
								displayName: 'Language',
								name: 'language',
								type: 'options',
								default: 'en',
								options: [
									{ name: 'English', value: 'en' },
									{ name: 'Estonian', value: 'et' },
									{ name: 'Latvian', value: 'lv' },
									{ name: 'Lithuanian', value: 'lt' },
									{ name: 'Polish', value: 'pl' },
									{ name: 'Russian', value: 'ru' },
									{ name: 'Ukrainian', value: 'uk' },
								],
							},
						],
					},
				],
			},
			{
				displayName: 'Delivery',
				name: 'delivery',
				type: 'options',
				default: 'link',
				displayOptions: { show: { operation: ['create'] } },
				options: [
					{ name: 'Return Ceremony Links', value: 'link' },
					{ name: 'Email Invitations', value: 'email' },
				],
				description:
					'Whether to return links for your workflow to deliver or ask TVARKA to email signers',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				default: {},
				placeholder: 'Add Field',
				displayOptions: { show: { operation: ['create'] } },
				options: [
					{
						displayName: 'Expires in Days',
						name: 'expiresInDays',
						type: 'number',
						default: 14,
						typeOptions: { minValue: 1, maxValue: 30 },
					},
					{
						displayName: 'External ID',
						name: 'externalId',
						type: 'string',
						default: '',
						description: 'Your CRM or document reference, echoed in API responses',
					},
					{
						displayName: 'Signing Order',
						name: 'signingOrder',
						type: 'options',
						default: 'parallel',
						options: [
							{ name: 'Parallel', value: 'parallel' },
							{ name: 'Sequential', value: 'sequential' },
						],
					},
				],
			},
			{
				displayName: 'Signing ID',
				name: 'signingId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['get', 'cancel', 'download', 'remind'] } },
			},
			{
				displayName: 'Signer ID',
				name: 'signerId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['remind'] } },
			},
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				displayOptions: { show: { operation: ['getAll'] } },
				description: 'Whether to return all results or only up to a given limit',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 50,
				typeOptions: { minValue: 1 },
				displayOptions: { show: { operation: ['getAll'], returnAll: [false] } },
				description: 'Max number of results to return',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				default: '',
				displayOptions: { show: { operation: ['getAll'] } },
				options: [
					{ name: 'Any', value: '' },
					{ name: 'Cancelled', value: 'cancelled' },
					{ name: 'Completed', value: 'completed' },
					{ name: 'Declined', value: 'declined' },
					{ name: 'Expired', value: 'expired' },
					{ name: 'Failed', value: 'failed' },
					{ name: 'Pending', value: 'pending' },
				],
			},
			{
				displayName: 'Output Binary Field',
				name: 'outputBinaryField',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: { show: { operation: ['download'] } },
				description: 'The output binary field for the downloaded document',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const output: INodeExecutionData[] = [];
		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				let result: IDataObject;
				if (operation === 'upload') {
					const property = this.getNodeParameter('binaryPropertyName', i) as string;
					const metadata = this.helpers.assertBinaryData(i, property);
					const fileName = (this.getNodeParameter('fileName', i) as string) || metadata.fileName;
					if (!fileName || /[\r\n"\\/]/.test(fileName))
						throw new NodeOperationError(
							this.getNode(),
							'Provide a filename with extension and no path separators',
							{ itemIndex: i },
						);
					const bytes = await this.helpers.getBinaryDataBuffer(i, property);
					if (!bytes.length || bytes.length > 100000000)
						throw new NodeOperationError(
							this.getNode(),
							'Upload must contain between 1 and 100,000,000 bytes',
							{ itemIndex: i },
						);
					let boundary = 'tvarkaN8nBoundary';
					while (bytes.includes(Buffer.from(boundary))) boundary += 'x';
					const body = Buffer.concat([
						Buffer.from(
							`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
						),
						bytes,
						Buffer.from(`\r\n--${boundary}--\r\n`),
					]);
					result = await request(this, 'POST', '/v1/files', {
						body,
						headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
					});
				} else if (operation === 'create') {
					const key = this.getNodeParameter('idempotencyKey', i) as string;
					if (!/^[\x21-\x7e]{1,128}$/.test(key))
						throw new NodeOperationError(
							this.getNode(),
							'Use an idempotency key of 1–128 visible ASCII characters',
							{ itemIndex: i },
						);
					const signerFields = this.getNodeParameter('signers', i) as { signer?: IDataObject[] };
					const signers = signerFields.signer || [];
					if (!signers.length || signers.length > 20 || signers.some((s) => !s.email))
						throw new NodeOperationError(
							this.getNode(),
							'Provide 1–20 signers with email addresses',
							{ itemIndex: i },
						);
					const fields = this.getNodeParameter('additionalFields', i) as IDataObject;
					const body: IDataObject = {
						title: this.getNodeParameter('title', i) as string,
						document: {
							name: this.getNodeParameter('documentName', i) as string,
							fileToken: identifier(
								this,
								this.getNodeParameter('fileToken', i) as string,
								'File token',
								i,
							),
						},
						signers: signers.map((s) => ({
							email: s.email,
							language: s.language || 'en',
							...(s.name ? { name: s.name } : {}),
						})),
						delivery: this.getNodeParameter('delivery', i) as string,
					};
					for (const field of ['expiresInDays', 'externalId', 'signingOrder']) {
						if (fields[field] !== undefined && fields[field] !== '') body[field] = fields[field];
					}
					result = await request(this, 'POST', '/v1/signings', {
						body,
						headers: { 'Idempotency-Key': key },
					});
				} else if (operation === 'getAll') {
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const limit = returnAll ? Infinity : Number(this.getNodeParameter('limit', i));
					if (limit !== Infinity && (!Number.isInteger(limit) || limit < 1))
						throw new NodeOperationError(this.getNode(), 'Limit must be a positive integer', {
							itemIndex: i,
						});
					const status = this.getNodeParameter('status', i) as string;
					let cursor = '';
					let count = 0;
					const seen = new Set<string>();
					do {
						const page = await request(this, 'GET', '/v1/signings', {
							qs: {
								limit: Math.min(100, limit - count),
								...(status ? { status } : {}),
								...(cursor ? { startingAfter: cursor } : {}),
							},
						});
						if (!Array.isArray(page.data))
							throw new NodeOperationError(
								this.getNode(),
								'The API returned an invalid signing list',
								{ itemIndex: i },
							);
						const entries = (page.data as IDataObject[]).slice(0, limit - count);
						for (const entry of entries) output.push({ json: entry, pairedItem: { item: i } });
						count += entries.length;
						if (!page.hasMore || count >= limit) break;
						cursor = String(page.nextCursor || '');
						if (!uuid.test(cursor) || seen.has(cursor) || !entries.length)
							throw new NodeOperationError(
								this.getNode(),
								'The API returned an invalid or repeated pagination cursor',
								{ itemIndex: i },
							);
						seen.add(cursor);
					} while (count < limit);
					continue;
				} else {
					const id = identifier(
						this,
						this.getNodeParameter('signingId', i) as string,
						'Signing ID',
						i,
					);
					const path = `/v1/signings/${id}`;
					if (operation === 'download') {
						const response = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'tvarkaSignApi',
							{
								method: 'GET',
								url: `${API}${path}/document`,
								encoding: 'arraybuffer',
								returnFullResponse: true,
								json: false,
								timeout: 120000,
								disableFollowRedirect: true,
							},
						);
						const headers = response.headers as Record<string, string>;
						const disposition = headers['content-disposition'] || '';
						const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i.exec(
							disposition,
						);
						let fileName = `${id}.bin`;
						if (match) {
							try {
								fileName = match[1] ? decodeURIComponent(match[1]) : (match[2] || match[3]).trim();
							} catch {
								/* Use safe fallback. */
							}
						}
						fileName = Array.from(fileName)
							.map((c) => (c.charCodeAt(0) < 32 || c === '/' || c === '\\' ? '_' : c))
							.join('');
						const binary = await this.helpers.prepareBinaryData(
							Buffer.from(response.body),
							fileName,
							headers['content-type'] || 'application/octet-stream',
						);
						const field = this.getNodeParameter('outputBinaryField', i) as string;
						if (!field)
							throw new NodeOperationError(this.getNode(), 'Output binary field is required', {
								itemIndex: i,
							});
						output.push({
							json: {
								signingId: id,
								fileName,
								sandbox: Boolean(headers['x-tvarka-sandbox']),
								sha256: headers['x-tvarka-document-sha256'] || '',
							},
							binary: { [field]: binary },
							pairedItem: { item: i },
						});
						continue;
					} else if (operation === 'get') result = await request(this, 'GET', path);
					else if (operation === 'cancel') result = await request(this, 'POST', `${path}/cancel`);
					else if (operation === 'remind') {
						const signerId = identifier(
							this,
							this.getNodeParameter('signerId', i) as string,
							'Signer ID',
							i,
						);
						result = await request(this, 'POST', `${path}/signers/${signerId}/remind`);
					} else
						throw new NodeOperationError(this.getNode(), `Unsupported operation: ${operation}`, {
							itemIndex: i,
						});
				}
				output.push({ json: result, pairedItem: { item: i } });
			} catch (error) {
				if (!this.continueOnFail())
					throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
				output.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
			}
		}
		return [output];
	}
}
