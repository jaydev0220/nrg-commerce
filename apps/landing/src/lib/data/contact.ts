import { Mail, MapPin, Phone, Printer } from '@lucide/svelte';
import * as m from '$lib/paraglide/messages';

export const contactItems = [
	{
		id: 'address',
		label: () => m.contact_address(),
		value: () => m.contact_address_value(),
		icon: MapPin
	},
	{
		id: 'phone',
		label: () => m.contact_phone(),
		value: () => m.contact_phone_value(),
		icon: Phone
	},
	{
		id: 'fax',
		label: () => m.contact_fax(),
		value: () => m.contact_fax_value(),
		icon: Printer
	},
	{
		id: 'email',
		label: () => m.contact_email(),
		value: () => m.contact_email_value(),
		icon: Mail
	}
] as const;
