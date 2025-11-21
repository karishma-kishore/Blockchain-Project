pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract AchievementSBT is 
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
    bytes32 public constant REVOKER_ROLE = keccak256("REVOKER_ROLE");

    bytes32 public constant MINT_PERMIT_TYPEHASH = keccak256(
        "MintPermit(address to,bytes32 eventId,bytes32 badgeType,string metadataURI,uint256 nonce,uint256 deadline)"
    );

    uint256 private _nextTokenId;
    
    mapping(uint256 => bool) public transferLock;
    
    mapping(uint256 => bool) public isRevoked;
    mapping(uint256 => string) public revocationReason;
    
    mapping(uint256 => bytes32) public eventId;
    mapping(uint256 => bytes32) public badgeType;
    mapping(uint256 => uint256) public issuedAt;
    
    mapping(address => uint256) public nonces;

    event AchievementMinted(
        uint256 indexed tokenId,
        address indexed recipient,
        bytes32 indexed eventId,
        bytes32 badgeType,
        string metadataURI,
        uint256 timestamp
    );

    event AchievementRevoked(
        uint256 indexed tokenId,
        string reason,
        address revokedBy,
        uint256 timestamp
    );

    event TransferLockSet(
        uint256 indexed tokenId,
        bool locked
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
        _grantRole(REVOKER_ROLE, admin);
    }

    function mintWithPermit(
        address to,
        bytes32 _eventId,
        bytes32 _badgeType,
        string memory metadataURI,
        uint256 deadline,
        bytes memory signature
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(block.timestamp <= deadline, "Permit expired");
        require(to != address(0), "Invalid recipient");

        bytes32 structHash = keccak256(
            abi.encode(
                MINT_PERMIT_TYPEHASH,
                to,
                _eventId,
                _badgeType,
                keccak256(bytes(metadataURI)),
                nonces[to]++,
                deadline
            )
        );

        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = hash.recover(signature);
        
        require(hasRole(MINTER_ROLE, signer), "Invalid signature");

        uint256 tokenId = _nextTokenId++;
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);
        
        eventId[tokenId] = _eventId;
        badgeType[tokenId] = _badgeType;
        issuedAt[tokenId] = block.timestamp;
        
        transferLock[tokenId] = true;

        emit AchievementMinted(
            tokenId,
            to,
            _eventId,
            _badgeType,
            metadataURI,
            block.timestamp
        );

        return tokenId;
    }

    function mint(
        address to,
        bytes32 _eventId,
        bytes32 _badgeType,
        string memory metadataURI
    ) external onlyRole(MINTER_ROLE) nonReentrant whenNotPaused returns (uint256) {
        require(to != address(0), "Invalid recipient");

        uint256 tokenId = _nextTokenId++;
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);
        
        eventId[tokenId] = _eventId;
        badgeType[tokenId] = _badgeType;
        issuedAt[tokenId] = block.timestamp;
        transferLock[tokenId] = true;

        emit AchievementMinted(
            tokenId,
            to,
            _eventId,
            _badgeType,
            metadataURI,
            block.timestamp
        );

        return tokenId;
    }

    function batchMint(
        address[] calldata recipients,
        bytes32[] calldata eventIds,
        bytes32[] calldata badgeTypes,
        string[] calldata metadataURIs
    ) external onlyRole(MINTER_ROLE) nonReentrant whenNotPaused {
        require(
            recipients.length == eventIds.length &&
            eventIds.length == badgeTypes.length &&
            badgeTypes.length == metadataURIs.length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 tokenId = _nextTokenId++;
            
            _safeMint(recipients[i], tokenId);
            _setTokenURI(tokenId, metadataURIs[i]);
            
            eventId[tokenId] = eventIds[i];
            badgeType[tokenId] = badgeTypes[i];
            issuedAt[tokenId] = block.timestamp;
            transferLock[tokenId] = true;

            emit AchievementMinted(
                tokenId,
                recipients[i],
                eventIds[i],
                badgeTypes[i],
                metadataURIs[i],
                block.timestamp
            );
        }
    }

    function revoke(uint256 tokenId, string memory reason) 
        external 
        onlyRole(REVOKER_ROLE) 
    {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(!isRevoked[tokenId], "Already revoked");

        isRevoked[tokenId] = true;
        revocationReason[tokenId] = reason;

        emit AchievementRevoked(tokenId, reason, msg.sender, block.timestamp);
    }

    function setTransferLock(uint256 tokenId, bool locked)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        transferLock[tokenId] = locked;
        emit TransferLockSet(tokenId, locked);
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        
        if (from != address(0) && to != address(0)) {
            require(!transferLock[tokenId], "Token is non-transferable");
        }
        
        return super._update(to, tokenId, auth);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function getTokenMetadata(uint256 tokenId) external view returns (
        bytes32 _eventId,
        bytes32 _badgeType,
        uint256 _issuedAt,
        bool _transferLock,
        bool _isRevoked,
        string memory _revocationReason
    ) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        
        return (
            eventId[tokenId],
            badgeType[tokenId],
            issuedAt[tokenId],
            transferLock[tokenId],
            isRevoked[tokenId],
            revocationReason[tokenId]
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
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title AchievementSBT
 * @dev ERC-721 contract for non-transferable achievement NFTs (Soulbound-like)
 * @notice Used for attendance, winner, and volunteer badges
 */
contract AchievementSBT is 
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
    bytes32 public constant REVOKER_ROLE = keccak256("REVOKER_ROLE");

    // EIP-712 typehash for minting permits
    bytes32 public constant MINT_PERMIT_TYPEHASH = keccak256(
        "MintPermit(address to,bytes32 eventId,bytes32 badgeType,string metadataURI,uint256 nonce,uint256 deadline)"
    );

    uint256 private _nextTokenId;
    
    // Mapping from token ID to transfer lock status
    mapping(uint256 => bool) public transferLock;
    
    // Mapping from token ID to revocation status
    mapping(uint256 => bool) public isRevoked;
    mapping(uint256 => string) public revocationReason;
    
    // Token metadata
    mapping(uint256 => bytes32) public eventId;
    mapping(uint256 => bytes32) public badgeType;
    mapping(uint256 => uint256) public issuedAt;
    
    // Nonces for permit signatures
    mapping(address => uint256) public nonces;

    // Events
    event AchievementMinted(
        uint256 indexed tokenId,
        address indexed recipient,
        bytes32 indexed eventId,
        bytes32 badgeType,
        string metadataURI,
        uint256 timestamp
    );

    event AchievementRevoked(
        uint256 indexed tokenId,
        string reason,
        address revokedBy,
        uint256 timestamp
    );

    event TransferLockSet(
        uint256 indexed tokenId,
        bool locked
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
        _grantRole(REVOKER_ROLE, admin);
    }

    /**
     * @dev Mint new achievement NFT with backend signature permit
     * @param to Recipient address
     * @param _eventId Event identifier
     * @param _badgeType Badge type identifier
     * @param metadataURI IPFS URI for token metadata
     * @param deadline Signature expiration timestamp
     * @param signature Backend EIP-712 signature
     */
    function mintWithPermit(
        address to,
        bytes32 _eventId,
        bytes32 _badgeType,
        string memory metadataURI,
        uint256 deadline,
        bytes memory signature
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(block.timestamp <= deadline, "Permit expired");
        require(to != address(0), "Invalid recipient");

        // Verify EIP-712 signature
        bytes32 structHash = keccak256(
            abi.encode(
                MINT_PERMIT_TYPEHASH,
                to,
                _eventId,
                _badgeType,
                keccak256(bytes(metadataURI)),
                nonces[to]++,
                deadline
            )
        );

        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = hash.recover(signature);
        
        require(hasRole(MINTER_ROLE, signer), "Invalid signature");

        uint256 tokenId = _nextTokenId++;
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);
        
        // Set metadata
        eventId[tokenId] = _eventId;
        badgeType[tokenId] = _badgeType;
        issuedAt[tokenId] = block.timestamp;
        
        // Achievement badges are non-transferable by default
        transferLock[tokenId] = true;

        emit AchievementMinted(
            tokenId,
            to,
            _eventId,
            _badgeType,
            metadataURI,
            block.timestamp
        );

        return tokenId;
    }

    /**
     * @dev Admin-only direct mint (for testing or emergency)
     */
    function mint(
        address to,
        bytes32 _eventId,
        bytes32 _badgeType,
        string memory metadataURI
    ) external onlyRole(MINTER_ROLE) nonReentrant whenNotPaused returns (uint256) {
        require(to != address(0), "Invalid recipient");

        uint256 tokenId = _nextTokenId++;
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);
        
        eventId[tokenId] = _eventId;
        badgeType[tokenId] = _badgeType;
        issuedAt[tokenId] = block.timestamp;
        transferLock[tokenId] = true;

        emit AchievementMinted(
            tokenId,
            to,
            _eventId,
            _badgeType,
            metadataURI,
            block.timestamp
        );

        return tokenId;
    }

    /**
     * @dev Batch mint for efficiency
     */
    function batchMint(
        address[] calldata recipients,
        bytes32[] calldata eventIds,
        bytes32[] calldata badgeTypes,
        string[] calldata metadataURIs
    ) external onlyRole(MINTER_ROLE) nonReentrant whenNotPaused {
        require(
            recipients.length == eventIds.length &&
            eventIds.length == badgeTypes.length &&
            badgeTypes.length == metadataURIs.length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 tokenId = _nextTokenId++;
            
            _safeMint(recipients[i], tokenId);
            _setTokenURI(tokenId, metadataURIs[i]);
            
            eventId[tokenId] = eventIds[i];
            badgeType[tokenId] = badgeTypes[i];
            issuedAt[tokenId] = block.timestamp;
            transferLock[tokenId] = true;

            emit AchievementMinted(
                tokenId,
                recipients[i],
                eventIds[i],
                badgeTypes[i],
                metadataURIs[i],
                block.timestamp
            );
        }
    }

    /**
     * @dev Revoke an achievement NFT
     */
    function revoke(uint256 tokenId, string memory reason) 
        external 
        onlyRole(REVOKER_ROLE) 
    {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(!isRevoked[tokenId], "Already revoked");

        isRevoked[tokenId] = true;
        revocationReason[tokenId] = reason;

        emit AchievementRevoked(tokenId, reason, msg.sender, block.timestamp);
    }

    /**
     * @dev Set transfer lock for a token (admin only)
     */
    function setTransferLock(uint256 tokenId, bool locked)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        transferLock[tokenId] = locked;
        emit TransferLockSet(tokenId, locked);
    }

    /**
     * @dev Override transfer functions to enforce transfer lock
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        
        // Allow minting and burning
        if (from != address(0) && to != address(0)) {
            require(!transferLock[tokenId], "Token is non-transferable");
        }
        
        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Pause contract
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Get token metadata
     */
    function getTokenMetadata(uint256 tokenId) external view returns (
        bytes32 _eventId,
        bytes32 _badgeType,
        uint256 _issuedAt,
        bool _transferLock,
        bool _isRevoked,
        string memory _revocationReason
    ) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        
        return (
            eventId[tokenId],
            badgeType[tokenId],
            issuedAt[tokenId],
            transferLock[tokenId],
            isRevoked[tokenId],
            revocationReason[tokenId]
        );
    }

    // Required overrides
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
