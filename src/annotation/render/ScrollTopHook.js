/*
* virtual-dom hook for scrolling to the text annotation.
*/
const Hook = function ScrollTopHook() {};
Hook.prototype.hook = function hook(node) {
  setTimeout(() => {
    const el = document.querySelector('.current');
    console.log(node.children[0]);
    console.log(el);
    if (el) {
      const box = node.getBoundingClientRect();
      const row = el.getBoundingClientRect();
      const diff = row.top - box.top;
      const list = node;
      list.scrollTop += diff;
    }
  }, 0);
};

export default Hook;
