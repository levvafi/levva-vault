// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IEtherFiAdmin {
  struct OracleReport {
    uint32 consensusVersion;
    uint32 refSlotFrom;
    uint32 refSlotTo;
    uint32 refBlockFrom;
    uint32 refBlockTo;
    int128 accruedRewards;
    uint256[] validatorsToApprove;
    uint256[] liquidityPoolValidatorsToExit;
    uint256[] exitedValidators;
    uint32[] exitedValidatorsExitTimestamps;
    uint256[] slashedValidators;
    uint256[] withdrawalRequestsToInvalidate;
    uint32 lastFinalizedWithdrawalRequestId;
    uint32 eEthTargetAllocationWeight;
    uint32 etherFanTargetAllocationWeight;
    uint128 finalizedWithdrawalAmount;
    uint32 numValidatorsToSpinUp;
  }

  function lastHandledReportRefSlot() external view returns (uint32);
  function lastHandledReportRefBlock() external view returns (uint32);
  function lastAdminExecutionBlock() external view returns (uint32);
  function numValidatorsToSpinUp() external view returns (uint32);

  function executeTasks(OracleReport calldata _report, bytes[] calldata _pubKey, bytes[] calldata _signature) external;
}
