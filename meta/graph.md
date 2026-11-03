The [research graph](/research/) uses a Poincaré disk. Main papers start near the centre, with references further out. Hyperbolic distance $h$ from the centre maps to disk radius $\rho$ through

$$
\rho = \tanh(h/2).
$$

Increasing $h$ brings $\rho$ closer to the boundary. Equal hyperbolic steps occupy less space on the screen near the edge.

For disk positions $\mathbf{p}$ and $\mathbf{q}$, the distance is

$$
d_H(\mathbf{p},\mathbf{q}) = \operatorname{arcosh}\!\left(1 + \frac{2\lVert\mathbf{p}-\mathbf{q}\rVert^2}{(1-\lVert\mathbf{p}\rVert^2)(1-\lVert\mathbf{q}\rVert^2)}\right).
$$

Edges follow geodesics, the shortest paths in this geometry. Drag a node and release it. The dots divide each path into equal hyperbolic distances.

