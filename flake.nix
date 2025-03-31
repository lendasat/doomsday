{
  description = "Development shell for doomsday software";

  inputs = {
    nixpkgs.url      = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url  = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config = {
            allowUnfree = true;
          };
        };
      in
        {
          devShells.default = with pkgs; mkShell {
            # TODO: Trim these.
            buildInputs = [
              nodejs_22
              yarn # Cannot easily use npm.
              pnpm
              corepack
            ];
          };
        }
    );
}
