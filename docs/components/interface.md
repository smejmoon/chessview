# Interface

The former **Interface** component boundary is now named [Lens](lens.md).

Lens is the governing presentation contract: it owns presentation preferences/environment, derives presentation geometry and composition constraints, and delegates DOM/Chessground mutation to `NodusRenderer` without owning current-view or chess-domain truth.

This file remains only as a compatibility pointer for older links; do not add new Interface requirements here.
