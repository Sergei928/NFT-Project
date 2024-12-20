// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTBot is ERC721, Ownable {
    uint256 public _lastTokenId;
    mapping(uint256 => string) private _tokenUris;

    event TokenMinted(address indexed to, uint256 tokenId);

    constructor(
        string memory _name,
        string memory _symbol
    ) ERC721(_name, _symbol) Ownable(msg.sender) {}

    function mint(address to, string calldata _uri) external onlyOwner {
        _lastTokenId += 1;
        _tokenUris[_lastTokenId] = _uri;
        _safeMint(to, _lastTokenId);

        emit TokenMinted(to, _lastTokenId);
    }

    /**
     * @dev See {ERC721-tokenURI}.
     */
    function tokenURI(
        uint256 _tokenId
    ) public view override returns (string memory) {
        return string(abi.encodePacked(_tokenUris[_tokenId]));
    }
}
