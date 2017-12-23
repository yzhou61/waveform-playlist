/*
* virtual-dom hook for maintaining the contenteditable.
*/
export default class {
  constructor(text) {
    this.text = text;
  }

  hook(node, prop, prev) {
    // editable is up to date
    if ((prev !== undefined)
      && (prev.text === this.text)) {
      return;
    }

    node.innerHTML = this.text;
  }
}
