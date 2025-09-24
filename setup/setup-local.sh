# Oracle accounts
solana account -u mainnet-beta --output json-compact --output-file oracle7.json 3DNK48NH6jvay2nHBiW3wk5yWegD9C2crk2vd9aznRz6
solana account -u mainnet-beta --output json-compact --output-file oracle6.json 7EyXLrFUtoRoYKhPBnRpjyo2nGTsfGgo2d7XcPb4TwPF
solana account -u mainnet-beta --output json-compact --output-file oracle5.json 2RN1v42zWzzKhLty3Dgen1vbRc4eBsE8PCHanvaSLwJc
solana account -u mainnet-beta --output json-compact --output-file oracle4.json CXyurDdbo9JR5Xh9QuknMJSsuGM3aQdsa38ZVrKSjp1c
solana account -u mainnet-beta --output json-compact --output-file oracle3.json GLc9EQ5ARgnBJvM59wU6eNjaeAEeBa1Gj7jp8rT5NJ8v
solana account -u mainnet-beta --output json-compact --output-file oracle2.json 8Vjo4QEbmB9QhhBu6QiTy66G1tw8WomtFVWECMi3a71y
solana account -u mainnet-beta --output json-compact --output-file oracle1.json BuZBFufhjGn1HDUCukJYognbeoQQW8ACZJq5sWoQPnGe
solana account -u mainnet-beta --output json-compact --output-file oracle0.json GcNZRMqGSEyEULZnLDD3ParcHTgFBrNfUdUCDtThP55e

# Randomness queue and config
solana account -u mainnet-beta --output json-compact --output-file randomness_queue.json A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w
solana account -u mainnet-beta --output json-compact --output-file sb_randomness_config.json 7Gs9n5FQMeC9XcEhg281bRZ6VHRrCvqp5Yq1j78HkvNa

# Program dumps
solana program dump -u mainnet-beta SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv ondemand.so
solana program dump -u mainnet-beta SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f switchboard.so
solana program dump -u mainnet-beta metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s metadata.so
