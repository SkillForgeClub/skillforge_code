/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CodingProblem, Student, Quiz, Submission, LeaderboardEntry } from '../types';

export const INITIAL_PROBLEMS: CodingProblem[] = [
  {
    id: 'prob-1',
    title: 'Two Sum',
    difficulty: 'Easy',
    category: 'Arrays & Hashing',
    statement: 'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.',
    inputFormat: 'The first line contains an integer N, the number of elements.\nThe second line contains N space-separated integers representing the array.\nThe third line contains a single integer representing the target.',
    outputFormat: 'Return two space-separated integers representing the indices of the elements.',
    constraints: '2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9',
    examples: [
      {
        input: '4\n2 7 11 15\n9',
        output: '0 1',
        explanation: 'Because nums[0] + nums[1] == 9, we return 0 1.'
      },
      {
        input: '3\n3 2 4\n6',
        output: '1 2'
      }
    ],
    starterTemplates: {
      'Python': 'n = int(input())\nnums = list(map(int, input().split()))\ntarget = int(input())\n# Write your solution here\n',
      'C': '#include <stdio.h>\n\nint main() {\n    int n, target;\n    if (scanf("%d", &n) != 1) return 0;\n    int nums[n];\n    for (int i = 0; i < n; i++) {\n        if (scanf("%d", &nums[i]) != 1) return 0;\n    }\n    if (scanf("%d", &target) != 1) return 0;\n    \n    // Write your nested loop or hashmap simulation here\n    for(int i = 0; i < n; i++) {\n        for(int j = i + 1; j < n; j++) {\n            if(nums[i] + nums[j] == target) {\n                printf("%d %d\\n", i, j);\n                return 0;\n            }\n        }\n    }\n    return 0;\n}',
      'C++': '#include <iostream>\n#include <vector>\n#include <unordered_map>\n\nusing namespace std;\n\nint main() {\n    int n, target;\n    if (!(cin >> n)) return 0;\n    vector<int> nums(n);\n    for (int i = 0; i < n; i++) {\n        cin >> nums[i];\n    }\n    cin >> target;\n    \n    unordered_map<int, int> m;\n    for (int i = 0; i < n; i++) {\n        int comp = target - nums[i];\n        if (m.count(comp)) {\n            cout << m[comp] << " " << i << endl;\n            return 0;\n        }\n        m[nums[i]] = i;\n    }\n    return 0;\n}',
      'Java': 'import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (!sc.hasNextInt()) return;\n        int n = sc.nextInt();\n        int[] nums = new int[n];\n        for (int i = 0; i < n; i++) {\n            nums[i] = sc.nextInt();\n        }\n        int target = sc.nextInt();\n        \n        Map<Integer, Integer> map = new HashMap<>();\n        for (int i = 0; i < n; i++) {\n            int complement = target - nums[i];\n            if (map.containsKey(complement)) {\n                System.out.println(map.get(complement) + " " + i);\n                return;\n            }\n            map.put(nums[i], i);\n        }\n    }\n}'
    },
    testCases: [
      { id: 'tc-1', input: '4\n2 7 11 15\n9', expectedOutput: '0 1', isPublic: true },
      { id: 'tc-2', input: '3\n3 2 4\n6', expectedOutput: '1 2', isPublic: true },
      { id: 'tc-3', input: '2\n3 3\n6', expectedOutput: '0 1', isPublic: false }
    ],
    solvedCount: 1420,
    acceptanceRate: 48.5,
    status: 'Solved'
  },
  {
    id: 'prob-2',
    title: 'Valid Palindrome',
    difficulty: 'Easy',
    category: 'Strings',
    statement: 'A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers.\n\nGiven a string `s`, return `true` if it is a palindrome, or `false` otherwise.',
    inputFormat: 'A single line containing the string s.',
    outputFormat: 'Print "true" if the string is a palindrome, else print "false".',
    constraints: '1 <= s.length <= 2 * 10^5\ns consists only of printable ASCII characters.',
    examples: [
      {
        input: 'A man, a plan, a canal: Panama',
        output: 'true',
        explanation: '"amanaplanacanalpanama" is a palindrome.'
      },
      {
        input: 'race a car',
        output: 'false',
        explanation: '"raceacar" is not a palindrome.'
      }
    ],
    starterTemplates: {
      'Python': 's = input()\n# Write your solution here\n',
      'C': '#include <stdio.h>\n#include <ctype.h>\n#include <string.h>\n\nint main() {\n    char s[200000];\n    if (fgets(s, sizeof(s), stdin) == NULL) return 0;\n    // Remove newline\n    s[strcspn(s, "\\n")] = 0;\n    \n    int left = 0;\n    int right = strlen(s) - 1;\n    while (left < right) {\n        while (left < right && !isalnum(s[left])) left++;\n        while (left < right && !isalnum(s[right])) right--;\n        if (tolower(s[left]) != tolower(s[right])) {\n            printf("false\\n");\n            return 0;\n        }\n        left++;\n        right--;\n    }\n    printf("true\\n");\n    return 0;\n}',
      'C++': '#include <iostream>\n#include <string>\n#include <cctype>\n\nusing namespace std;\n\nint main() {\n    string s;\n    getline(cin, s);\n    int left = 0, right = s.length() - 1;\n    while (left < right) {\n        while (left < right && !isalnum(s[left])) left++;\n        while (left < right && !isalnum(s[right])) right--;\n        if (tolower(s[left]) != tolower(s[right])) {\n            cout << "false" << endl;\n            return 0;\n        }\n        left++;\n        right--;\n    }\n    cout << "true" << endl;\n    return 0;\n}',
      'Java': 'import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (!sc.hasNextLine()) return;\n        String s = sc.nextLine();\n        int left = 0, right = s.length() - 1;\n        while (left < right) {\n            while (left < right && !Character.isLetterOrDigit(s.charAt(left))) left++;\n            while (left < right && !Character.isLetterOrDigit(s.charAt(right))) right--;\n            if (Character.toLowerCase(s.charAt(left)) != Character.toLowerCase(s.charAt(right))) {\n                System.out.println("false");\n                return;\n            }\n            left++;\n            right--;\n        }\n        System.out.println("true");\n    }\n}'
    },
    testCases: [
      { id: 'tc-1', input: 'A man, a plan, a canal: Panama', expectedOutput: 'true', isPublic: true },
      { id: 'tc-2', input: 'race a car', expectedOutput: 'false', isPublic: true },
      { id: 'tc-3', input: '0P', expectedOutput: 'false', isPublic: false }
    ],
    solvedCount: 950,
    acceptanceRate: 53.2,
    status: 'Attempted'
  },
  {
    id: 'prob-3',
    title: 'Container With Most Water',
    difficulty: 'Medium',
    category: 'Two Pointers',
    statement: 'You are given an integer array `height` of length `n`. There are `n` vertical lines drawn such that the two endpoints of the `i-th` line are `(i, 0)` and `(i, height[i])`.\n\nFind two lines that together with the x-axis form a container, such that the container contains the most water.\n\nReturn the maximum amount of water a container can store.\n\nNotice that you may not slant the container.',
    inputFormat: 'The first line contains N, the size of the array.\nThe second line contains N space-separated integers representing the Heights.',
    outputFormat: 'Print a single integer representing the maximum water container volume.',
    constraints: 'n == height.length\n2 <= n <= 10^5\n0 <= height[i] <= 10^4',
    examples: [
      {
        input: '9\n1 8 6 2 5 4 8 3 7',
        output: '49',
        explanation: 'The above vertical lines are represented by array [1,8,6,2,5,4,8,3,7]. In this case, the max area of water (blue section) the container can contain is 49.'
      },
      {
        input: '2\n1 1',
        output: '1'
      }
    ],
    starterTemplates: {
      'Python': 'n = int(input())\nheight = list(map(int, input().split()))\n# Write your solution here\n',
      'C': '#include <stdio.h>\n\n#define MIN(a, b) ((a) < (b) ? (a) : (b))\n#define MAX(a, b) ((a) > (b) ? (a) : (b))\n\nint main() {\n    int n;\n    if (scanf("%d", &n) != 1) return 0;\n    int height[n];\n    for (int i = 0; i < n; i++) {\n        if (scanf("%d", &height[i]) != 1) return 0;\n    }\n    \n    int left = 0, right = n - 1;\n    int max_w = 0;\n    while (left < right) {\n        int w = right - left;\n        int h = MIN(height[left], height[right]);\n        max_w = MAX(max_w, w * h);\n        if (height[left] < height[right]) left++;\n        else right--;\n    }\n    printf("%d\\n", max_w);\n    return 0;\n}',
      'C++': '#include <iostream>\n#include <vector>\n#include <algorithm>\n\nusing namespace std;\n\nint main() {\n    int n;\n    if (!(cin >> n)) return 0;\n    vector<int> height(n);\n    for (int i = 0; i < n; i++) cin >> height[i];\n    \n    int left = 0, right = n - 1;\n    int max_w = 0;\n    while (left < right) {\n        int w = right - left;\n        int h = min(height[left], height[right]);\n        max_w = max(max_w, w * h);\n        if (height[left] < height[right]) left++;\n        else right--;\n    }\n    cout << max_w << endl;\n    return 0;\n}',
      'Java': 'import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (!sc.hasNextInt()) return;\n        int n = sc.nextInt();\n        int[] height = new int[n];\n        for (int i = 0; i < n; i++) height[i] = sc.nextInt();\n        \n        int left = 0, right = n - 1;\n        int max_w = 0;\n        while (left < right) {\n            int w = right - left;\n            int h = Math.min(height[left], height[right]);\n            max_w = Math.max(max_w, w * h);\n            if (height[left] < height[right]) left++;\n            else right--;\n        }\n        System.out.println(max_w);\n    }\n}'
    },
    testCases: [
      { id: 'tc-1', input: '9\n1 8 6 2 5 4 8 3 7', expectedOutput: '49', isPublic: true },
      { id: 'tc-2', input: '2\n1 1', expectedOutput: '1', isPublic: true },
      { id: 'tc-3', input: '5\n4 3 2 1 4', expectedOutput: '16', isPublic: false }
    ],
    solvedCount: 610,
    acceptanceRate: 39.1,
    status: 'Unsolved'
  },
  {
    id: 'prob-4',
    title: 'Longest Consecutive Sequence',
    difficulty: 'Medium',
    category: 'Arrays & Hashing',
    statement: 'Given an unsorted array of integers `nums`, return the length of the longest consecutive elements sequence.\n\nYou must write an algorithm that runs in `O(n)` time.',
    inputFormat: 'The first line contains N, the size of the array.\nThe second line contains N space-separated integers.',
    outputFormat: 'Print a single integer representing the longest consecutive sequence.',
    constraints: '0 <= nums.length <= 10^5\n-10^9 <= nums[i] <= 10^9',
    examples: [
      {
        input: '6\n100 4 200 1 3 2',
        output: '4',
        explanation: 'The longest consecutive elements sequence is [1, 2, 3, 4]. Therefore its length is 4.'
      },
      {
        input: '10\n0 3 7 2 5 8 4 6 0 1',
        output: '9'
      }
    ],
    starterTemplates: {
      'Python': 'n = int(input())\nnums = list(map(int, input().split())) if n > 0 else []\n# Write your solution here\n',
      'C': '#include <stdio.h>\n#include <stdlib.h>\n\nint compare(const void* a, const void* b) {\n    return (*(int*)a - *(int*)b);\n}\n\nint main() {\n    int n;\n    if (scanf("%d", &n) != 1) return 0;\n    if (n == 0) { printf("0\\n"); return 0; }\n    int* nums = malloc(sizeof(int) * n);\n    for (int i = 0; i < n; i++) {\n        if (scanf("%d", &nums[i]) != 1) return 0;\n    }\n    \n    qsort(nums, n, sizeof(int), compare);\n    \n    int longest = 1;\n    int current = 1;\n    for (int i = 1; i < n; i++) {\n        if (nums[i] != nums[i - 1]) {\n            if (nums[i] == nums[i - 1] + 1) {\n                current++;\n            } else {\n                if (current > longest) longest = current;\n                current = 1;\n            }\n        }\n    }\n    if (current > longest) longest = current;\n    printf("%d\\n", longest);\n    free(nums);\n    return 0;\n}',
      'C++': '#include <iostream>\n#include <vector>\n#include <unordered_set>\n#include <algorithm>\n\nusing namespace std;\n\nint main() {\n    int n;\n    if (!(cin >> n)) return 0;\n    if (n == 0) { cout << 0 << endl; return 0; }\n    vector<int> nums(n);\n    unordered_set<int> s;\n    for (int i = 0; i < n; i++) {\n        cin >> nums[i];\n        s.insert(nums[i]);\n    }\n    int longest = 0;\n    for (int x : s) {\n        if (!s.count(x - 1)) {\n            int curr = x;\n            int streak = 1;\n            while (s.count(curr + 1)) {\n                curr++;\n                streak++;\n            }\n            longest = max(longest, streak);\n        }\n    }\n    cout << longest << endl;\n    return 0;\n}',
      'Java': 'import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (!sc.hasNextInt()) return;\n        int n = sc.nextInt();\n        Set<Integer> set = new HashSet<>();\n        for (int i = 0; i < n; i++) {\n            set.add(sc.nextInt());\n        }\n        int longest = 0;\n        for (int num : set) {\n            if (!set.contains(num - 1)) {\n                int curr = num;\n                int streak = 1;\n                while (set.contains(curr + 1)) {\n                    curr++;\n                    streak++;\n                }\n                longest = Math.max(longest, streak);\n            }\n        }\n        System.out.println(longest);\n    }\n}'
    },
    testCases: [
      { id: 'tc-1', input: '6\n100 4 200 1 3 2', expectedOutput: '4', isPublic: true },
      { id: 'tc-2', input: '10\n0 3 7 2 5 8 4 6 0 1', expectedOutput: '9', isPublic: true },
      { id: 'tc-3', input: '0', expectedOutput: '0', isPublic: false }
    ],
    solvedCount: 420,
    acceptanceRate: 31.8,
    status: 'Unsolved'
  },
  {
    id: 'prob-5',
    title: 'Median of Two Sorted Arrays',
    difficulty: 'Hard',
    category: 'Binary Search',
    statement: 'Given two sorted arrays `nums1` and `nums2` of size `m` and `n` respectively, return the median of the two sorted arrays.\n\nThe overall run time complexity should be `O(log (m+n))`.',
    inputFormat: 'The first line contains M, the size of array 1, and N, the size of array 2.\nThe second line contains M space-separated sorted integers representing array 1.\nThe third line contains N space-separated sorted integers representing array 2.',
    outputFormat: 'Print a double representing the median (formatted up to 5 decimal places).',
    constraints: 'nums1.length == m, nums2.length == n\n0 <= m <= 1000\n0 <= n <= 1000\n-10^6 <= nums1[i], nums2[i] <= 10^6',
    examples: [
      {
        input: '2 1\n1 3\n2',
        output: '2.00000',
        explanation: 'Merged array = [1,2,3] and median is 2.'
      },
      {
        input: '2 2\n1 2\n3 4',
        output: '2.50000',
        explanation: 'Merged array = [1,2,3,4] and median is (2 + 3) / 2 = 2.5.'
      }
    ],
    starterTemplates: {
      'Python': 'm, n = map(int, input().split())\nnums1 = list(map(int, input().split())) if m > 0 else []\nnums2 = list(map(int, input().split())) if n > 0 else []\n# Write your solution here\n',
      'C': '#include <stdio.h>\n#include <stdlib.h>\n\nint compare(const void* a, const void* b) {\n    return (*(int*)a - *(int*)b);\n}\n\nint main() {\n    int m, n;\n    if (scanf("%d %d", &m, &n) != 2) return 0;\n    int total = m + n;\n    int* merged = malloc(sizeof(int) * total);\n    for(int i = 0; i < m; i++) scanf("%d", &merged[i]);\n    for(int i = 0; i < n; i++) scanf("%d", &merged[m + i]);\n    \n    qsort(merged, total, sizeof(int), compare);\n    \n    if (total % 2 != 0) {\n        printf("%.5f\\n", (double)merged[total / 2]);\n    } else {\n        printf("%.5f\\n", (double)(merged[total / 2 - 1] + merged[total / 2]) / 2.0);\n    }\n    free(merged);\n    return 0;\n}',
      'C++': '#include <iostream>\n#include <vector>\n#include <algorithm>\n#include <iomanip>\n\nusing namespace std;\n\nint main() {\n    int m, n;\n    if (!(cin >> m >> n)) return 0;\n    vector<int> nums(m + n);\n    for (int i = 0; i < m + n; i++) cin >> nums[i];\n    sort(nums.begin(), nums.end());\n    \n    int total = m + n;\n    cout << fixed << setprecision(5);\n    if (total % 2 != 0) {\n        cout << (double)nums[total / 2] << endl;\n    } else {\n        cout << (double)(nums[total / 2 - 1] + nums[total / 2]) / 2.0 << endl;\n    }\n    return 0;\n}',
      'Java': 'import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (!sc.hasNextInt()) return;\n        int m = sc.nextInt();\n        int n = sc.nextInt();\n        List<Integer> list = new ArrayList<>();\n        for (int i = 0; i < m; i++) list.add(sc.nextInt());\n        for (int i = 0; i < n; i++) list.add(sc.nextInt());\n        Collections.sort(list);\n        \n        int total = m + n;\n        if (total % 2 != 0) {\n            System.out.printf(Locale.US, "%.5f\\n", (double)list.get(total / 2));\n        } else {\n            double median = (list.get(total / 2 - 1) + list.get(total / 2)) / 2.0;\n            System.out.printf(Locale.US, "%.5f\\n", median);\n        }\n    }\n}'
    },
    testCases: [
      { id: 'tc-1', input: '2 1\n1 3\n2', expectedOutput: '2.00000', isPublic: true },
      { id: 'tc-2', input: '2 2\n1 2\n3 4', expectedOutput: '2.50000', isPublic: true },
      { id: 'tc-3', input: '1 1\n10\n10', expectedOutput: '10.00000', isPublic: false }
    ],
    solvedCount: 154,
    acceptanceRate: 19.3,
    status: 'Unsolved'
  }
];

export const INITIAL_STUDENTS: Student[] = [
  {
    id: 'stud-1',
    fullName: 'Rahul Sharma',
    rollNumber: '22CS8012',
    email: 'rahul.sharma@college.edu',
    starRating: 4,
    level: 18,
    rank: 12,
    problemsSolved: { easy: 45, medium: 32, hard: 8 },
    streak: 15,
    points: 0,
    certificates: [
      { id: 'cert-1', title: 'Data Structures Mastery', issueDate: '2026-04-12', credentialUrl: '#' },
      { id: 'cert-2', title: 'Python Elite Coder', issueDate: '2026-06-01', credentialUrl: '#' }
    ],
    badges: [
      { id: 'badge-1', name: 'Streak Sentinel', icon: '🔥', description: 'Maintained a 10-day coding streak', unlockedAt: '2026-06-15' },
      { id: 'badge-2', name: 'Algorithm Architect', icon: '🛠️', description: 'Solved 30 Medium difficulty problems', unlockedAt: '2026-06-30' },
      { id: 'badge-3', name: 'Speed Demon', icon: '⚡', description: 'Solved a problem within 2 minutes of opening', unlockedAt: '2026-07-02' }
    ]
  },
  {
    id: 'stud-2',
    fullName: 'Priya Patel',
    rollNumber: '22CS8045',
    email: 'priya.patel@college.edu',
    starRating: 5,
    level: 24,
    rank: 3,
    problemsSolved: { easy: 65, medium: 52, hard: 21 },
    streak: 42,
    points: 0,
    certificates: [
      { id: 'cert-3', title: 'Algorithm Specialist', issueDate: '2026-02-15', credentialUrl: '#' },
      { id: 'cert-4', title: 'Dynamic Programming Legend', issueDate: '2026-05-10', credentialUrl: '#' }
    ],
    badges: [
      { id: 'badge-4', name: 'Infinity Streak', icon: '🌀', description: 'Maintained a 30-day coding streak', unlockedAt: '2026-06-20' },
      { id: 'badge-5', name: 'Binary Wizard', icon: '🧙‍♂️', description: 'Solved 15 Binary Search problems', unlockedAt: '2026-07-01' },
      { id: 'badge-6', name: 'Hard Core', icon: '💀', description: 'Solved 20 Hard problems', unlockedAt: '2026-07-05' }
    ]
  },
  {
    id: 'stud-3',
    fullName: 'Aman Verma',
    rollNumber: '22CS8102',
    email: 'aman.verma@college.edu',
    starRating: 3,
    level: 11,
    rank: 88,
    problemsSolved: { easy: 22, medium: 12, hard: 1 },
    streak: 3,
    points: 0,
    certificates: [],
    badges: [
      { id: 'badge-1', name: 'First Milestone', icon: '🌱', description: 'Solved 10 Easy problems', unlockedAt: '2026-05-18' }
    ]
  },
  {
    id: 'stud-4',
    fullName: 'Ananya Reddy',
    rollNumber: '22EC9041',
    email: 'ananya.reddy@college.edu',
    starRating: 4,
    level: 15,
    rank: 34,
    problemsSolved: { easy: 38, medium: 21, hard: 4 },
    streak: 9,
    points: 0,
    certificates: [
      { id: 'cert-5', title: 'Java Core Certification', issueDate: '2026-05-20', credentialUrl: '#' }
    ],
    badges: [
      { id: 'badge-1', name: 'Streak Sentinel', icon: '🔥', description: 'Maintained a 10-day coding streak', unlockedAt: '2026-06-25' }
    ]
  },
  {
    id: 'stud-5',
    fullName: 'Vikram Singh',
    rollNumber: '22IT7032',
    email: 'vikram.singh@college.edu',
    starRating: 3,
    level: 9,
    rank: 105,
    problemsSolved: { easy: 18, medium: 8, hard: 0 },
    streak: 0,
    points: 0,
    certificates: [],
    badges: []
  },
  {
    id: 'stud-6',
    fullName: 'Sneha Iyer',
    rollNumber: '22CS8078',
    email: 'sneha.iyer@college.edu',
    starRating: 4,
    level: 16,
    rank: 22,
    problemsSolved: { easy: 40, medium: 28, hard: 6 },
    streak: 11,
    points: 0,
    certificates: [
      { id: 'cert-6', title: 'C++ Masterclass', issueDate: '2026-03-30', credentialUrl: '#' }
    ],
    badges: [
      { id: 'badge-2', name: 'Algorithm Architect', icon: '🛠️', description: 'Solved 30 Medium difficulty problems', unlockedAt: '2026-07-01' }
    ]
  }
];

export const INITIAL_SUBMISSIONS: Submission[] = [
  {
    id: 'sub-1',
    problemId: 'prob-1',
    problemTitle: 'Two Sum',
    language: 'Python',
    code: 'def two_sum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in seen:\n            return [seen[complement], i]\n        seen[num] = i',
    status: 'Accepted',
    submittedAt: '2026-07-06T14:32:00Z',
    executionTimeMs: 42,
    memoryKb: 14200
  },
  {
    id: 'sub-2',
    problemId: 'prob-2',
    problemTitle: 'Valid Palindrome',
    language: 'C++',
    code: '#include <iostream>\n#include <string>\nusing namespace std;\nint main() {\n    string s;\n    getline(cin, s);\n    // Partial incorrect logic\n    cout << "false";\n    return 0;\n}',
    status: 'Wrong Answer',
    submittedAt: '2026-07-06T15:10:00Z',
    executionTimeMs: 8,
    memoryKb: 3200
  },
  {
    id: 'sub-3',
    problemId: 'prob-1',
    problemTitle: 'Two Sum',
    language: 'Java',
    code: 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) {\n        // Unoptimized brute force causing TLE simulation\n        while(true) {}\n    }\n}',
    status: 'Time Limit Exceeded',
    submittedAt: '2026-07-05T09:21:00Z',
    executionTimeMs: 2000,
    memoryKb: 45000
  },
  {
    id: 'sub-4',
    problemId: 'prob-3',
    problemTitle: 'Container With Most Water',
    language: 'Python',
    code: 'def max_area(height):\n    left, right = 0, len(height) - 1\n    max_w = 0\n    while left < right:\n        w = right - left\n        h = min(height[left], height[right])\n        max_w = max(max_w, w * h)\n        if height[left] < height[right]:\n            left += 1\n        else:\n            right -= 1\n    return max_w',
    status: 'Accepted',
    submittedAt: '2026-07-04T18:44:00Z',
    executionTimeMs: 95,
    memoryKb: 16500
  }
];

export const INITIAL_QUIZZES: Quiz[] = [
  {
    id: 'quiz-1',
    title: 'Mid-Semester Algorithmic Battle',
    description: 'Solve core data structure problems on arrays, hash maps, and two pointers under strict time constraints.',
    startTime: '2026-07-08T10:00:00Z',
    endTime: '2026-07-08T11:00:00Z',
    durationMinutes: 60,
    status: 'Upcoming',
    questions: [
      {
        id: 'q-1',
        questionText: 'What is the average time complexity of searching for an element in a balanced Binary Search Tree (BST)?',
        type: 'multiple-choice',
        options: ['O(1)', 'O(log N)', 'O(N)', 'O(N log N)'],
        correctOption: 1,
        points: 5
      },
      {
        id: 'q-2',
        questionText: 'Given an array representing heights, write an optimized algorithm to find the container with the most water.',
        type: 'coding',
        codingProblem: INITIAL_PROBLEMS[2], // Container with most water
        points: 15
      }
    ],
    participantsCount: 145
  },
  {
    id: 'quiz-2',
    title: 'Weekend Speedrun #4',
    description: 'A 30-minute rapid coding test focusing on basic operations, string palindrome validation, and arrays.',
    startTime: '2026-07-07T06:00:00Z', // Currently running / active live quiz!
    endTime: '2026-07-07T08:00:00Z',
    durationMinutes: 120,
    status: 'Live',
    questions: [
      {
        id: 'q-3',
        questionText: 'Which data structure is best suited for implementing a Depth First Search (DFS) of a graph iteratively?',
        type: 'multiple-choice',
        options: ['Queue', 'Stack', 'Heap', 'Hash Map'],
        correctOption: 1,
        points: 5
      },
      {
        id: 'q-4',
        questionText: 'Solve the Valid Palindrome problem by writing a clean, efficient palindrome check ignoring punctuation and casing.',
        type: 'coding',
        codingProblem: INITIAL_PROBLEMS[1], // Valid Palindrome
        points: 15
      }
    ],
    participantsCount: 84
  },
  {
    id: 'quiz-3',
    title: 'CodeForge Inaugural Quiz',
    description: 'The foundation assessment of programming logic, simple sums, and standard linear data structures.',
    startTime: '2026-06-15T09:00:00Z',
    endTime: '2026-06-15T10:30:00Z',
    durationMinutes: 90,
    status: 'Completed',
    questions: [
      {
        id: 'q-5',
        questionText: 'Which sorting algorithm has a worst-case time complexity of O(N^2) but is highly efficient in practice due to small constant factors and cache friendliness?',
        type: 'multiple-choice',
        options: ['Merge Sort', 'Quick Sort', 'Heap Sort', 'Radix Sort'],
        correctOption: 1,
        points: 5
      },
      {
        id: 'q-6',
        questionText: 'Solve the standard Two Sum problem.',
        type: 'coding',
        codingProblem: INITIAL_PROBLEMS[0], // Two Sum
        points: 15
      }
    ],
    participantsCount: 210
  }
];

export const INITIAL_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, studentId: 'stud-100', fullName: 'Divya Senthil', rollNumber: '22CS8015', solvedCount: 154, points: 2840, streak: 48, starRating: 5 },
  { rank: 2, studentId: 'stud-101', fullName: 'Arjun Mehta', rollNumber: '22CS8002', solvedCount: 142, points: 2650, streak: 35, starRating: 5 },
  { rank: 3, studentId: 'stud-2', fullName: 'Priya Patel', rollNumber: '22CS8045', solvedCount: 138, points: 2590, streak: 42, starRating: 5 },
  { rank: 4, studentId: 'stud-102', fullName: 'Karan Malhotra', rollNumber: '22IT7011', solvedCount: 110, points: 2120, streak: 21, starRating: 4 },
  { rank: 5, studentId: 'stud-103', fullName: 'Rhea Sen', rollNumber: '22CS8094', solvedCount: 98, points: 1980, streak: 18, starRating: 4 },
  { rank: 12, studentId: 'stud-1', fullName: 'Rahul Sharma', rollNumber: '22CS8012', solvedCount: 85, points: 1720, streak: 15, starRating: 4 },
  { rank: 22, studentId: 'stud-6', fullName: 'Sneha Iyer', rollNumber: '22CS8078', solvedCount: 74, points: 1450, streak: 11, starRating: 4 },
  { rank: 34, studentId: 'stud-4', fullName: 'Ananya Reddy', rollNumber: '22EC9041', solvedCount: 63, points: 1210, streak: 9, starRating: 4 },
  { rank: 88, studentId: 'stud-3', fullName: 'Aman Verma', rollNumber: '22CS8102', solvedCount: 35, points: 740, streak: 3, starRating: 3 },
  { rank: 105, studentId: 'stud-5', fullName: 'Vikram Singh', rollNumber: '22IT7032', solvedCount: 26, points: 510, streak: 0, starRating: 3 }
];
