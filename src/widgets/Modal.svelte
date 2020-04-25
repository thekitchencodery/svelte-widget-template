<script>
  import { fade } from "svelte/transition";

  function handleOverlayClick(e) {
      this.dispatchEvent(close("clicked on the background"));
  }

  function handleClose(e){
    this.dispatchEvent(close("clicked on the 'x' button"));
  }

  function close(reason) {
    show = false;
   return new CustomEvent('message', {
			detail: { text: `Modal ${name} was closed because you ${reason}!` },
			bubbles: true,
			cancelable: true,
			composed: true,
		});

  }

  export let name = "Unknown";

  export let show = false;
</script>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.75);
    z-index: 10;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .modal-container {
    position: relative;
    background-color: #ffffff;
    width: 50vw;
    margin: 1rem auto 0.2rem;
    box-shadow: 0 3px 10px #555;
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

  main {
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

{#if show}
  <div>
    <div
      class="modal-overlay"
      on:click={handleOverlayClick}
      transition:fade={{ duration: 200 }}>
      <div class="modal-container">
      <span class="close" on:click={handleClose}>&times;</span>
        <main>
          <p>Hello {name}</p>
        </main>
      </div>
    </div>
  </div>
{/if}
