import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TvarkaSignApi implements ICredentialType {
	name = 'tvarkaSignApi';
	displayName = 'TVARKA Sign API';
	documentationUrl = 'https://sign-api.tvarka.pro/docs#keys';
	icon = 'file:../nodes/TvarkaSign/tvarka.svg' as const;
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your TVARKA Sign API key. Production keys start with tsk_live_; existing sandbox keys start with tsk_test_.',
		},
	];
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: { headers: { Authorization: '=Bearer {{$credentials.apiKey}}' } },
	};
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://sign-api.tvarka.pro',
			url: '/v1/signings',
			qs: { limit: 1 },
		},
	};
}
