{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.nodejs_latest
    pkgs.nodePackages.prettier

    # keep this line if you use bash
    pkgs.bashInteractive
  ];
}
