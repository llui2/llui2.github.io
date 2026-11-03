Linked nodes pull or push according to their distance error.

$$
\mathbf{F}_i^{\mathrm{link}} = k_\ell\sum_{j\sim i}\bigl[d_H(\mathbf{x}_i,\mathbf{x}_j)-\ell_{ij}\bigr]\hat{\mathbf{e}}_{ij}.
$$

$\ell_{ij}$ is the preferred distance and $\hat{\mathbf{e}}_{ij}$ points towards node $j$ in disk coordinates. Radial forces pull towards a preferred radius. Repulsion separates nearby nodes. Their sum gives $\mathbf{F}_i$.

$$
\begin{aligned}
\mathbf{v}_i^{n+1} &= \gamma\bigl(\mathbf{v}_i^n+\mathbf{F}_i^n\bigr),\\
\mathbf{x}_i^{n+1} &= \mathbf{x}_i^n+\mathbf{v}_i^{n+1}.
\end{aligned}
$$

$\gamma$ damps the motion. Velocity is capped and positions stay inside the disk. Distances are hyperbolic, while these updates use disk coordinates.
