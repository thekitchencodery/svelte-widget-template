<script>
	import { fly } from 'svelte/transition';
	import Modal from './Modal.svelte';

	export let show = false;
	let modal_show = false;

	function interceptEvent(event) {
		console.log('here');
		const newEvent = new CustomEvent('message', {
			detail: { text: 'The sidebar noticed the modal was closed!' },
			bubbles: true,
			cancelable: true,
			composed: true,
		});

		this.dispatchEvent(newEvent);
	}

	function close() {
		show = false;
	}
</script>

<style>
	nav {
		position: fixed;
		top: 0;
		left: 0;
		height: 100%;
		padding: 3rem 2rem;
		border-right: 1px solid #aaa;
		background: #fff;
		overflow-y: auto;
		width: 30rem;
	}

	.close {
		color: #aaa;
		cursor: pointer;
		position: absolute;
		top: 0.5em;
		right: 0;
		padding: 0.8rem 0.5rem;
		transform: translate(0%, -50%);
		font-size: 2rem;
		transition: all 200ms ease-in-out;
	}

	.close:hover {
		color: #000;
	}
</style>

<!-- Allow the exported props to be set externally -->
<svelte:options accessors />
{#if show}
	<nav transition:fly={{ x: -250, opacity: 1 }}>
		<span class="close" on:click={close}>&times;</span>
		<h3>This is the Sidebar widget</h3>
    <hr/>
		<button
			on:click={() => {
				modal_show = true;
			}}>
			Toggle Modal
		</button>

	</nav>
{/if}

<Modal bind:show={modal_show} name="from the sidebar widget" />
