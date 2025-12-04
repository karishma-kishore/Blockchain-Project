// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract Collectible721 is 
    ERC721, 
    ERC721URIStorage, 
    AccessControl, 
    Pausable, 
    ReentrancyGuard,
    EIP712
{
    using ECDSA for bytes32;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    bytes32 public constant MINT_PERMIT_TYPEHASH = keccak256(
        "MintPermit(address to,bytes32 collectibleType,string metadataURI,uint256 nonce,uint256 deadline)"
    );

    uint256 private _nextTokenId;
    
    mapping(uint256 => bytes32) public collectibleType;
    mapping(uint256 => uint256) public issuedAt;
    mapping(uint256 => uint256) public series;
    mapping(uint256 => uint256) public serialNumber;
    
    mapping(bytes32 => uint256) public maxSupply;
    mapping(bytes32 => uint256) public currentSupply;
    
    mapping(address => uint256) public nonces;

    event CollectibleMinted(
        uint256 indexed tokenId,
        address indexed recipient,
        bytes32 indexed collectibleType,
        string metadataURI,
        uint256 series,
        uint256 serialNumber,
        uint256 timestamp
    );

    event MaxSupplySet(
        bytes32 indexed collectibleType,
        uint256 maxSupply
    );

    constructor(
        string memory name,
        string memory symbol,
        address admin,
        address minter
    ) ERC721(name, symbol) EIP712(name, "1") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(PAUSER_ROLE, admin);
    }

    function setMaxSupply(bytes32 _collectibleType, uint256 _maxSupply)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_maxSupply == 0 || _maxSupply >= currentSupply[_collectibleType], 
            "Max supply cannot be less than current supply");
        
        maxSupply[_collectibleType] = _maxSupply;
        emit MaxSupplySet(_collectibleType, _maxSupply);
    }

    function mintWithPermit(
        address to,
        bytes32 _collectibleType,
        string memory metadataURI,
        uint256 _series,
        uint256 deadline,
        bytes memory signature
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(block.timestamp <= deadline, "Permit expired");
        require(to != address(0), "Invalid recipient");

        uint256 typeMaxSupply = maxSupply[_collectibleType];
        if (typeMaxSupply > 0) {
            require(currentSupply[_collectibleType] < typeMaxSupply, "Max supply reached");
        }

        bytes32 structHash = keccak256(
            abi.encode(
                MINT_PERMIT_TYPEHASH,
                to,
                _collectibleType,
                keccak256(bytes(metadataURI)),
                nonces[to]++,
                deadline
            )
        );

        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = hash.recover(signature);
        
        require(hasRole(MINTER_ROLE, signer), "Invalid signature");

        uint256 tokenId = _nextTokenId++;
        uint256 serialNum = currentSupply[_collectibleType]++;
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);
        
        collectibleType[tokenId] = _collectibleType;
        issuedAt[tokenId] = block.timestamp;
        series[tokenId] = _series;
        serialNumber[tokenId] = serialNum;

        emit CollectibleMinted(
            tokenId,
            to,
            _collectibleType,
            metadataURI,
            _series,
            serialNum,
            block.timestamp
        );

        return tokenId;
    }

    function mint(
        address to,
        bytes32 _collectibleType,
        string memory metadataURI,
        uint256 _series
    ) external onlyRole(MINTER_ROLE) nonReentrant whenNotPaused returns (uint256) {
        require(to != address(0), "Invalid recipient");

        uint256 typeMaxSupply = maxSupply[_collectibleType];
        if (typeMaxSupply > 0) {
            require(currentSupply[_collectibleType] < typeMaxSupply, "Max supply reached");
        }

        uint256 tokenId = _nextTokenId++;
        uint256 serialNum = currentSupply[_collectibleType]++;
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);
        
        collectibleType[tokenId] = _collectibleType;
        issuedAt[tokenId] = block.timestamp;
        series[tokenId] = _series;
        serialNumber[tokenId] = serialNum;

        emit CollectibleMinted(
            tokenId,
            to,
            _collectibleType,
            metadataURI,
            _series,
            serialNum,
            block.timestamp
        );

        return tokenId;
    }

    function batchMint(
        address[] calldata recipients,
        bytes32[] calldata collectibleTypes,
        string[] calldata metadataURIs,
        uint256 _series
    ) external onlyRole(MINTER_ROLE) nonReentrant whenNotPaused {
        require(
            recipients.length == collectibleTypes.length &&
            collectibleTypes.length == metadataURIs.length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < recipients.length; i++) {
            bytes32 cType = collectibleTypes[i];
            
            uint256 typeMaxSupply = maxSupply[cType];
            if (typeMaxSupply > 0) {
                require(currentSupply[cType] < typeMaxSupply, "Max supply reached");
            }

            uint256 tokenId = _nextTokenId++;
            uint256 serialNum = currentSupply[cType]++;
            
            _safeMint(recipients[i], tokenId);
            _setTokenURI(tokenId, metadataURIs[i]);
            
            collectibleType[tokenId] = cType;
            issuedAt[tokenId] = block.timestamp;
            series[tokenId] = _series;
            serialNumber[tokenId] = serialNum;

            emit CollectibleMinted(
                tokenId,
                recipients[i],
                cType,
                metadataURIs[i],
                _series,
                serialNum,
                block.timestamp
            );
        }
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function getTokenMetadata(uint256 tokenId) external view returns (
        bytes32 _collectibleType,
        uint256 _issuedAt,
        uint256 _series,
        uint256 _serialNumber,
        uint256 _maxSupply,
        uint256 _currentSupply
    ) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        
        bytes32 cType = collectibleType[tokenId];
        
        return (
            cType,
            issuedAt[tokenId],
            series[tokenId],
            serialNumber[tokenId],
            maxSupply[cType],
            currentSupply[cType]
        );
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
