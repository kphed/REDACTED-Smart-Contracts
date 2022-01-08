// SPDX-License-Identifier: MIT
pragma solidity 0.7.5;

interface IwxBTRFLY {
    function realIndex() external view returns (uint256);
}

contract BTRFLYIndexProvider {
    address public immutable wxBTRFLY;

    event FetchIndex(uint256 index);

    constructor(address _wxBTRFLY) {
        require(_wxBTRFLY != address(0));
        wxBTRFLY = _wxBTRFLY;
    }

    /**
        @notice Fetches and emits real index from wxBTRFLY contract
        @return uint256
     */
    function fetchIndex() external returns (uint256) {
        uint256 realIndex = IwxBTRFLY(wxBTRFLY).realIndex();

        emit FetchIndex(realIndex);

        return realIndex;
    }
}
