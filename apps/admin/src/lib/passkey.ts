function decodeBase64Url(value: string): ArrayBuffer {
	const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
	const paddingLength = (4 - (normalized.length % 4)) % 4;
	const padded = normalized.padEnd(normalized.length + paddingLength, '=');
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);

	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}

	return bytes.buffer;
}

function encodeBase64Url(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function mapCredentialDescriptors(
	descriptors:
		Array<{ id: string; type: PublicKeyCredentialType; transports?: string[] }> | undefined
) {
	return descriptors?.map((descriptor) => ({
		...descriptor,
		transports: descriptor.transports as AuthenticatorTransport[] | undefined,
		id: decodeBase64Url(descriptor.id)
	}));
}

function toCreationOptions(raw: unknown): PublicKeyCredentialCreationOptions {
	const source = raw as Record<string, unknown>;
	const user = source['user'] as Record<string, unknown>;

	return {
		...(source as unknown as PublicKeyCredentialCreationOptions),
		challenge: decodeBase64Url(String(source['challenge'])),
		user: {
			...(user as unknown as PublicKeyCredentialUserEntity),
			id: decodeBase64Url(String(user['id']))
		},
		excludeCredentials: mapCredentialDescriptors(
			source['excludeCredentials'] as Array<{
				id: string;
				type: PublicKeyCredentialType;
				transports?: string[];
			}>
		)
	};
}

function toRequestOptions(raw: unknown): PublicKeyCredentialRequestOptions {
	const source = raw as Record<string, unknown>;

	return {
		...(source as unknown as PublicKeyCredentialRequestOptions),
		challenge: decodeBase64Url(String(source['challenge'])),
		allowCredentials: mapCredentialDescriptors(
			source['allowCredentials'] as Array<{
				id: string;
				type: PublicKeyCredentialType;
				transports?: string[];
			}>
		)
	};
}

function assertPublicKeyCredential(
	credential: Credential | null
): asserts credential is PublicKeyCredential {
	if (!(credential instanceof PublicKeyCredential)) {
		throw new Error('瀏覽器未回傳有效的通行密鑰憑證。');
	}
}

function serializeRegistrationCredential(credential: PublicKeyCredential) {
	const response = credential.response as AuthenticatorAttestationResponse;

	return {
		id: credential.id,
		rawId: encodeBase64Url(credential.rawId),
		response: {
			clientDataJSON: encodeBase64Url(response.clientDataJSON),
			attestationObject: encodeBase64Url(response.attestationObject),
			transports: typeof response.getTransports === 'function' ? response.getTransports() : []
		},
		type: credential.type,
		clientExtensionResults: credential.getClientExtensionResults(),
		authenticatorAttachment: credential.authenticatorAttachment ?? null
	};
}

function serializeAuthenticationCredential(credential: PublicKeyCredential) {
	const response = credential.response as AuthenticatorAssertionResponse;

	return {
		id: credential.id,
		rawId: encodeBase64Url(credential.rawId),
		response: {
			clientDataJSON: encodeBase64Url(response.clientDataJSON),
			authenticatorData: encodeBase64Url(response.authenticatorData),
			signature: encodeBase64Url(response.signature),
			userHandle: response.userHandle ? encodeBase64Url(response.userHandle) : null
		},
		type: credential.type,
		clientExtensionResults: credential.getClientExtensionResults(),
		authenticatorAttachment: credential.authenticatorAttachment ?? null
	};
}

function ensurePasskeySupport(): void {
	if (
		typeof window === 'undefined' ||
		typeof navigator === 'undefined' ||
		typeof navigator.credentials === 'undefined' ||
		typeof PublicKeyCredential === 'undefined'
	) {
		throw new Error('此瀏覽器不支援通行密鑰。');
	}
}

export async function registerPasskey(optionsJson: unknown) {
	ensurePasskeySupport();
	const credential = await navigator.credentials.create({
		publicKey: toCreationOptions(optionsJson)
	});

	assertPublicKeyCredential(credential);
	return serializeRegistrationCredential(credential);
}

export async function authenticateWithPasskey(
	optionsJson: unknown,
	mediation: CredentialMediationRequirement = 'optional',
	signal?: AbortSignal
) {
	ensurePasskeySupport();
	const credential = await navigator.credentials.get({
		publicKey: toRequestOptions(optionsJson),
		mediation,
		signal
	});

	assertPublicKeyCredential(credential);
	return serializeAuthenticationCredential(credential);
}
