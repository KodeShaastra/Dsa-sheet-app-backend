// Sheet content for prisma/seed.ts.
// Each problem is [title, leetcodeSlug, difficulty]. The practice URL is built from the slug.
// YouTube and article links: only add ones you have checked (see `videos` and `articles` below).

export type SeedDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type SeedProblem = [title: string, slug: string, difficulty: SeedDifficulty];

export interface SeedChapter {
  title: string;
  slug: string;
  topics: { title: string; problems: SeedProblem[] }[];
}

export const leetcodeUrl = (slug: string) => `https://leetcode.com/problems/${slug}/`;
export const youtubeUrl = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;

/**
 * Apna College videos for some Arrays problems: LeetCode slug → YouTube video id.
 * Each one was checked (2026-10-17) with YouTube's oEmbed lookup: the video exists and the channel is
 * "Apna College". Problems without a clear video are left out, so the sheet shows "No video yet".
 */
export const videos: Record<string, string> = {
  'two-sum': '0Fxc_jKj2vo',
  'best-time-to-buy-and-sell-stock': 'WBzZCm46mFo',
  'majority-element': '_xqIp2rj8bo',
  'product-of-array-except-self': 'TW2m8m_FNJE',
  'sort-colors': 'J48aGjfjYTI',
  '3sum': 'K-RsltkN63w',
  'container-with-most-water': 'EbkMABpP52U',
  'trapping-rain-water': 'BsPbCLj4_Mw',
  'maximum-subarray': '9IZYqostl2M',
  'subarray-sum-equals-k': 'KDH4mhFVvHw',
};

/**
 * Free articles for the Arrays problems: LeetCode slug → URL. Checked 2026-10-17:
 * LeetCode editorials only where LeetCode's API says the editorial is free (not premium);
 * GeeksforGeeks pages loaded (200) and their title matches the problem. Contains Duplicate has none.
 */
export const articles: Record<string, string> = {
  'two-sum': 'https://leetcode.com/problems/two-sum/editorial/',
  'move-zeroes': 'https://leetcode.com/problems/move-zeroes/editorial/',
  'subarray-sum-equals-k': 'https://leetcode.com/problems/subarray-sum-equals-k/editorial/',
  'merge-intervals': 'https://leetcode.com/problems/merge-intervals/editorial/',
  'best-time-to-buy-and-sell-stock':
    'https://www.geeksforgeeks.org/dsa/best-time-to-buy-and-sell-stock/',
  'majority-element': 'https://www.geeksforgeeks.org/dsa/majority-element/',
  'product-of-array-except-self': 'https://www.geeksforgeeks.org/dsa/a-product-array-puzzle/',
  'sort-colors': 'https://www.geeksforgeeks.org/dsa/sort-an-array-of-0s-1s-and-2s/',
  '3sum': 'https://www.geeksforgeeks.org/dsa/find-triplets-array-whose-sum-equal-zero/',
  'container-with-most-water': 'https://www.geeksforgeeks.org/dsa/container-with-most-water/',
  'trapping-rain-water': 'https://www.geeksforgeeks.org/dsa/trapping-rain-water/',
  'maximum-subarray': 'https://www.geeksforgeeks.org/dsa/largest-sum-contiguous-subarray/',
  'longest-consecutive-sequence':
    'https://www.geeksforgeeks.org/dsa/longest-consecutive-subsequence/',
};

export const chapters: SeedChapter[] = [
  {
    title: 'Arrays',
    slug: 'arrays',
    topics: [
      {
        title: 'Basics & Hashing',
        problems: [
          ['Two Sum', 'two-sum', 'EASY'],
          ['Contains Duplicate', 'contains-duplicate', 'EASY'],
          ['Best Time to Buy and Sell Stock', 'best-time-to-buy-and-sell-stock', 'EASY'],
          ['Majority Element', 'majority-element', 'EASY'],
          ['Move Zeroes', 'move-zeroes', 'EASY'],
          ['Product of Array Except Self', 'product-of-array-except-self', 'MEDIUM'],
        ],
      },
      {
        title: 'Two Pointers',
        problems: [
          ['Sort Colors', 'sort-colors', 'MEDIUM'],
          ['3Sum', '3sum', 'MEDIUM'],
          ['Container With Most Water', 'container-with-most-water', 'MEDIUM'],
          ['Trapping Rain Water', 'trapping-rain-water', 'HARD'],
        ],
      },
      {
        title: 'Prefix Sum & Intervals',
        problems: [
          ['Maximum Subarray', 'maximum-subarray', 'MEDIUM'],
          ['Subarray Sum Equals K', 'subarray-sum-equals-k', 'MEDIUM'],
          ['Longest Consecutive Sequence', 'longest-consecutive-sequence', 'MEDIUM'],
          ['Merge Intervals', 'merge-intervals', 'MEDIUM'],
        ],
      },
    ],
  },
  {
    title: 'Strings',
    slug: 'strings',
    topics: [
      {
        title: 'Basics',
        problems: [
          ['Valid Anagram', 'valid-anagram', 'EASY'],
          ['Valid Palindrome', 'valid-palindrome', 'EASY'],
          ['Longest Common Prefix', 'longest-common-prefix', 'EASY'],
          ['Group Anagrams', 'group-anagrams', 'MEDIUM'],
          ['Reverse Words in a String', 'reverse-words-in-a-string', 'MEDIUM'],
        ],
      },
      {
        title: 'Sliding Window',
        problems: [
          [
            'Longest Substring Without Repeating Characters',
            'longest-substring-without-repeating-characters',
            'MEDIUM',
          ],
          [
            'Longest Repeating Character Replacement',
            'longest-repeating-character-replacement',
            'MEDIUM',
          ],
          ['Permutation in String', 'permutation-in-string', 'MEDIUM'],
          ['Minimum Window Substring', 'minimum-window-substring', 'HARD'],
        ],
      },
      {
        title: 'Palindromes & Parsing',
        problems: [
          ['Longest Palindromic Substring', 'longest-palindromic-substring', 'MEDIUM'],
          ['Palindromic Substrings', 'palindromic-substrings', 'MEDIUM'],
          ['String to Integer (atoi)', 'string-to-integer-atoi', 'MEDIUM'],
        ],
      },
    ],
  },
  {
    title: 'Linked List',
    slug: 'linked-list',
    topics: [
      {
        title: 'Basics',
        problems: [
          ['Reverse Linked List', 'reverse-linked-list', 'EASY'],
          ['Merge Two Sorted Lists', 'merge-two-sorted-lists', 'EASY'],
          ['Middle of the Linked List', 'middle-of-the-linked-list', 'EASY'],
          ['Remove Nth Node From End of List', 'remove-nth-node-from-end-of-list', 'MEDIUM'],
          ['Add Two Numbers', 'add-two-numbers', 'MEDIUM'],
        ],
      },
      {
        title: 'Fast & Slow Pointers',
        problems: [
          ['Linked List Cycle', 'linked-list-cycle', 'EASY'],
          ['Palindrome Linked List', 'palindrome-linked-list', 'EASY'],
          ['Linked List Cycle II', 'linked-list-cycle-ii', 'MEDIUM'],
          ['Reorder List', 'reorder-list', 'MEDIUM'],
        ],
      },
      {
        title: 'Advanced',
        problems: [
          ['Copy List with Random Pointer', 'copy-list-with-random-pointer', 'MEDIUM'],
          ['LRU Cache', 'lru-cache', 'MEDIUM'],
          ['Merge k Sorted Lists', 'merge-k-sorted-lists', 'HARD'],
          ['Reverse Nodes in k-Group', 'reverse-nodes-in-k-group', 'HARD'],
        ],
      },
    ],
  },
  {
    title: 'Stack & Queue',
    slug: 'stack-and-queue',
    topics: [
      {
        title: 'Stack Basics',
        problems: [
          ['Valid Parentheses', 'valid-parentheses', 'EASY'],
          ['Implement Queue using Stacks', 'implement-queue-using-stacks', 'EASY'],
          ['Min Stack', 'min-stack', 'MEDIUM'],
          ['Evaluate Reverse Polish Notation', 'evaluate-reverse-polish-notation', 'MEDIUM'],
        ],
      },
      {
        title: 'Monotonic Stack',
        problems: [
          ['Next Greater Element I', 'next-greater-element-i', 'EASY'],
          ['Daily Temperatures', 'daily-temperatures', 'MEDIUM'],
          ['Car Fleet', 'car-fleet', 'MEDIUM'],
          ['Largest Rectangle in Histogram', 'largest-rectangle-in-histogram', 'HARD'],
        ],
      },
      {
        title: 'Queue & Deque',
        problems: [
          ['Implement Stack using Queues', 'implement-stack-using-queues', 'EASY'],
          ['Design Circular Queue', 'design-circular-queue', 'MEDIUM'],
          ['Sliding Window Maximum', 'sliding-window-maximum', 'HARD'],
        ],
      },
    ],
  },
  {
    title: 'Binary Search',
    slug: 'binary-search',
    topics: [
      {
        title: 'On Sorted Arrays',
        problems: [
          ['Binary Search', 'binary-search', 'EASY'],
          ['Search Insert Position', 'search-insert-position', 'EASY'],
          [
            'Find First and Last Position of Element in Sorted Array',
            'find-first-and-last-position-of-element-in-sorted-array',
            'MEDIUM',
          ],
          ['Search in Rotated Sorted Array', 'search-in-rotated-sorted-array', 'MEDIUM'],
          [
            'Find Minimum in Rotated Sorted Array',
            'find-minimum-in-rotated-sorted-array',
            'MEDIUM',
          ],
          ['Search a 2D Matrix', 'search-a-2d-matrix', 'MEDIUM'],
        ],
      },
      {
        title: 'Binary Search on Answer',
        problems: [
          ['Koko Eating Bananas', 'koko-eating-bananas', 'MEDIUM'],
          [
            'Capacity To Ship Packages Within D Days',
            'capacity-to-ship-packages-within-d-days',
            'MEDIUM',
          ],
          ['Split Array Largest Sum', 'split-array-largest-sum', 'HARD'],
          ['Median of Two Sorted Arrays', 'median-of-two-sorted-arrays', 'HARD'],
        ],
      },
    ],
  },
  {
    title: 'Trees',
    slug: 'trees',
    topics: [
      {
        title: 'Traversals',
        problems: [
          ['Binary Tree Inorder Traversal', 'binary-tree-inorder-traversal', 'EASY'],
          ['Maximum Depth of Binary Tree', 'maximum-depth-of-binary-tree', 'EASY'],
          ['Invert Binary Tree', 'invert-binary-tree', 'EASY'],
          ['Binary Tree Level Order Traversal', 'binary-tree-level-order-traversal', 'MEDIUM'],
          ['Binary Tree Right Side View', 'binary-tree-right-side-view', 'MEDIUM'],
        ],
      },
      {
        title: 'Binary Search Tree',
        problems: [
          ['Validate Binary Search Tree', 'validate-binary-search-tree', 'MEDIUM'],
          ['Kth Smallest Element in a BST', 'kth-smallest-element-in-a-bst', 'MEDIUM'],
          [
            'Lowest Common Ancestor of a Binary Search Tree',
            'lowest-common-ancestor-of-a-binary-search-tree',
            'MEDIUM',
          ],
        ],
      },
      {
        title: 'Recursion on Trees',
        problems: [
          ['Same Tree', 'same-tree', 'EASY'],
          ['Diameter of Binary Tree', 'diameter-of-binary-tree', 'EASY'],
          [
            'Construct Binary Tree from Preorder and Inorder Traversal',
            'construct-binary-tree-from-preorder-and-inorder-traversal',
            'MEDIUM',
          ],
          ['Binary Tree Maximum Path Sum', 'binary-tree-maximum-path-sum', 'HARD'],
          [
            'Serialize and Deserialize Binary Tree',
            'serialize-and-deserialize-binary-tree',
            'HARD',
          ],
        ],
      },
    ],
  },
  {
    title: 'Graphs',
    slug: 'graphs',
    topics: [
      {
        title: 'BFS & DFS',
        problems: [
          ['Flood Fill', 'flood-fill', 'EASY'],
          ['Number of Islands', 'number-of-islands', 'MEDIUM'],
          ['Clone Graph', 'clone-graph', 'MEDIUM'],
          ['Rotting Oranges', 'rotting-oranges', 'MEDIUM'],
          ['Pacific Atlantic Water Flow', 'pacific-atlantic-water-flow', 'MEDIUM'],
          ['Word Ladder', 'word-ladder', 'HARD'],
        ],
      },
      {
        title: 'Topological Sort',
        problems: [
          ['Course Schedule', 'course-schedule', 'MEDIUM'],
          ['Course Schedule II', 'course-schedule-ii', 'MEDIUM'],
        ],
      },
      {
        title: 'Shortest Path & Union Find',
        problems: [
          ['Number of Provinces', 'number-of-provinces', 'MEDIUM'],
          ['Redundant Connection', 'redundant-connection', 'MEDIUM'],
          ['Network Delay Time', 'network-delay-time', 'MEDIUM'],
          ['Cheapest Flights Within K Stops', 'cheapest-flights-within-k-stops', 'MEDIUM'],
          ['Min Cost to Connect All Points', 'min-cost-to-connect-all-points', 'MEDIUM'],
        ],
      },
    ],
  },
  {
    title: 'Dynamic Programming',
    slug: 'dynamic-programming',
    topics: [
      {
        title: '1D DP',
        problems: [
          ['Climbing Stairs', 'climbing-stairs', 'EASY'],
          ['House Robber', 'house-robber', 'MEDIUM'],
          ['Decode Ways', 'decode-ways', 'MEDIUM'],
          ['Coin Change', 'coin-change', 'MEDIUM'],
          ['Word Break', 'word-break', 'MEDIUM'],
          ['Longest Increasing Subsequence', 'longest-increasing-subsequence', 'MEDIUM'],
        ],
      },
      {
        title: '2D DP',
        problems: [
          ['Unique Paths', 'unique-paths', 'MEDIUM'],
          ['Longest Common Subsequence', 'longest-common-subsequence', 'MEDIUM'],
          ['Partition Equal Subset Sum', 'partition-equal-subset-sum', 'MEDIUM'],
          ['Edit Distance', 'edit-distance', 'MEDIUM'],
          ['Burst Balloons', 'burst-balloons', 'HARD'],
          ['Regular Expression Matching', 'regular-expression-matching', 'HARD'],
        ],
      },
    ],
  },
];
