// Inspired by https://github.com/BarnBridge/BarnBridge-YieldFarming/blob/master/contracts/CommunityVault.sol
// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract Vault is Ownable {

    IERC20 private SLICE;

    constructor (address sliceAddress) public {
        SLICE = IERC20(sliceAddress);
    }

    event SetAllowance(address indexed caller, address indexed spender, uint256 amount);

    function setAllowance(address spender, uint amount) public onlyOwner {
        SLICE.approve(spender, amount);

        emit SetAllowance(msg.sender, spender, amount);
    }
}
