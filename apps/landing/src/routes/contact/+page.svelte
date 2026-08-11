<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ContactInfo from '$lib/components/contact/ContactInfo.svelte';
	import ContactForm from '$lib/components/contact/ContactForm.svelte';
	import * as m from '$lib/paraglide/messages';
</script>

<PageHeader
	breadcrumb={m.breadcrumb_contact()}
	title={m.contact_page_title()}
/>

<section class="bg-bg-page py-16 lg:py-20">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="grid gap-12 lg:grid-cols-5 lg:gap-16">
			<div class="lg:col-span-2">
				<ContactInfo />
			</div>

			<div class="lg:col-span-3">
				<ContactForm />
			</div>
		</div>
	</div>
</section>
