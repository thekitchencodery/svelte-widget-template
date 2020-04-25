<script>
	import Modal from './widgets/Modal.svelte';

	let modal_show = false;

	function openSidebar() {
		
		this.dispatchEvent(
			new CustomEvent('openSidebar', {
				bubbles: true,
				cancelable: true,
				composed: true,
			})
		);
	}
</script>

<style>
	.main {
		border: 1rem;
		padding: 1rem;
		border-radius: 5px;
		box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2),
			0 6px 20px 0 rgba(0, 0, 0, 0.19);
		text-align: center;
		display: flex;
		flex-flow: column;
	}
</style>

<div class="main">
	<h3>This is the 'Main.svelte' widget</h3>
	<button on:click={() => (modal_show = !modal_show)}>Toggle Modal</button>

	<button on:click={openSidebar}>Open Sidebar (event)</button>
</div>
<Modal bind:show={modal_show} name="from the 'Main.svelte' widget" />
