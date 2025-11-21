// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title SunDevilBadge
 * @notice ERC-721 contract for issuing SunDevilSync 2.0 achievement NFTs.
 *         Metadata is expected to live on IPFS (full URI provided at mint time).
 *         Admins (MINTER_ROLE) can issue badges to students for events/achievements.
 */
contract SunDevilBadge is ERC721URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 private _tokenIds;

    struct Badge {
        uint256 eventId;
        string eventName;
        string eventDate;
        string achievementType; // attended / winner / participation etc.
        string metadataURI; // full IPFS metadata URI
        uint256 issuedAt;
        address issuer;
    }

    mapping(uint256 => Badge) private _badgeDetails;

    event BadgeIssued(
        uint256 indexed tokenId,
        address indexed student,
        uint256 indexed eventId,
        string achievementType,
        string metadataURI
    );

    constructor() ERC721("SunDevil Badge", "SDB") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    /**
     * @notice Issue a badge NFT to a student for a given event/achievement.
     * @param student Recipient wallet address.
     * @param eventId Numeric event identifier (kept in sync with web app DB).
     * @param eventName Human friendly event name.
     * @param eventDate Event date (ISO string) for quick on-chain verification.
     * @param achievementType Category of badge (attended/winner/organizer/etc.).
     * @param metadataURI Full IPFS URI (e.g. ipfs://CID/metadata.json) that stores student+event details.
     */
    function issueBadge(
        address student,
        uint256 eventId,
        string memory eventName,
        string memory eventDate,
        string memory achievementType,
        string memory metadataURI
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        require(student != address(0), "Invalid student address");
        require(bytes(metadataURI).length > 0, "Metadata URI required");

        unchecked {
            _tokenIds += 1;
        }
        uint256 newTokenId = _tokenIds;

        _safeMint(student, newTokenId);
        _setTokenURI(newTokenId, metadataURI);

        _badgeDetails[newTokenId] = Badge({
            eventId: eventId,
            eventName: eventName,
            eventDate: eventDate,
            achievementType: achievementType,
            metadataURI: metadataURI,
            issuedAt: block.timestamp,
            issuer: msg.sender
        });

        emit BadgeIssued(newTokenId, student, eventId, achievementType, metadataURI);
        return newTokenId;
    }

    /**
     * @dev Allow admins to add/remove badge issuers (e.g., central service or event admins).
     */
    function setMinter(address account, bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Invalid account");
        if (enabled) {
            _grantRole(MINTER_ROLE, account);
        } else {
            _revokeRole(MINTER_ROLE, account);
        }
    }

    /**
     * @notice Returns badge info for verification portals.
     */
    function getBadge(uint256 tokenId) external view returns (Badge memory badge) {
        require(_ownerOf(tokenId) != address(0), "Badge does not exist");
        return _badgeDetails[tokenId];
    }

    function totalMinted() external view returns (uint256) {
        return _tokenIds;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
