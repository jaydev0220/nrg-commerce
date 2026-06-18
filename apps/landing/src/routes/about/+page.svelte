<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import CompanyStory from '$lib/components/about/CompanyStory.svelte';
	import Timeline from '$lib/components/about/Timeline.svelte';
	import * as m from '$lib/paraglide/messages';
</script>

<PageHeader breadcrumb={m.breadcrumb_about()} title={m.about_page_title()} />

<CompanyStory />
<Timeline />
