# mrva.gl game template

## Simple WebGL framework

The aim of this project was to create a dead-simple framework
that's easy to use and can easily be expanded.  
I made it primarely for personal use, so documentation will be lackluster.

Mrva uses WeGL1 for fast rendering, html for simple text drawing
and a simple dictionary wrapper for managing assets.

## Example usage

You can see how to use the framework in `index.html` and `example.js`.  
The point of Mrva is to be easily expandable and it should be,
because it's extremely bare-bones in it's functionality.

## Notes and best practices

The update loop has a dynamic framerate due to `requestAnimationFrame`
being used internally.  
This can be easily changed by modifying the `run` function.

When drawing sprites, try to clump draws from one texture together.  
This will minimize WebGL state changes and make best use of batched rendering.
