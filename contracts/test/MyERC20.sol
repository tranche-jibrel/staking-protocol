// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";

contract MyERC20 is OwnableUpgradeSafe, ERC20UpgradeSafe {
    using SafeMath for uint256;

    function initialize(uint256 _initialSupply, string memory name, string memory symbol) public initializer {
        OwnableUpgradeSafe.__Ownable_init();
        ERC20UpgradeSafe.__ERC20_init_unchained(name, symbol);
        _mint(address(0), _initialSupply.mul(10 ** 18));
    }

}
